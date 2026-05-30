# Implementation Plan: I-3 — Craft skill editor

> Companion to `intent.md`. Records the agreed implementation approach for the
> I-3 outcome. Not spec — apply at implementation time. The intent itself
> (problem/outcome/non-goals) remains the source of truth and is edited only via
> `/ls-intent`.

## Context

Authoring a skill today means hand-editing `SKILL.md` and discovering spec
violations only at install time (or never). Intent **I-3** adds **Craft**: an
in-app structured editor that validates frontmatter live and **blocks
publish/install of a skill whose frontmatter fails spec validation, showing the
failing rule inline**. That single EARS outcome is the whole of I-3; everything
here serves it.

The validator already exists and is already exposed — I-1 built
`core::conformance::evaluate(skill_md, parent_dir_name) -> Conformance`, wired as
the `check_conformance` Tauri command and surfaced in the frontend as
`api.checkConformance(...)`. Reusing it satisfies the constraint *"one validation
source of truth, mirrored, not forked"* (and P-6). Craft owns only the editor
gate; the shop/install pipeline (I-1) is untouched.

**Decisions taken with the user (2026-05-29):**
- Editor surface: **structured frontmatter fields + a body textarea** (Craft assembles `SKILL.md`).
- Scope: **new skills *and* editing an existing installed skill** (loaded from the active target).
- Publish: **writes the skill directory into the currently-active target** (project/global from `AppContext`); the backend **re-validates** before writing.

Log these via `/ls-decisions` during implementation (`[intent: I-3]`).

## What already exists (reuse, do not fork)

- **Validator + types** — `core/src/conformance/` (`evaluate`, `Conformance`, `Verdict`, `Finding`, `is_installable()`). `Invalid` blocks; `Warnings` allowed (mirror the install gate exactly).
- **IPC command** — `check_conformance(skill_md, parent_dir_name) -> Conformance` in `src-tauri/src/commands.rs`; works on in-memory text, no FS.
- **Frontend client** — `api.checkConformance(skillMd, parentDirName)` in `src/api/client.ts`; types in `src/api/bindings.ts`.
- **Display** — `src/components/ConformanceBadge.tsx` (verdict pill + findings tooltip).
- **Nav scaffolding** — `Tab` union already includes `'craft'` (`src/state/AppContext.tsx`); `Tabs.tsx` has the tab present but `enabled: false` ("Coming in I-3"); `App.tsx` falls through to an empty screen.
- **Install/atomic write reference** — `core/src/fs_skills/mod.rs` (`install`: materialize → validate-before-write → atomic copy) and its `atomic_install_dir` helper.

## Two real gaps

1. **No backend command writes/reads a `SKILL.md`** for editing (only `install_local_skill` from a source dir).
2. **vitest is not configured at all** — no runner, deps, config, or `test` script — yet the outcome's test is `vitest:src/screens/Craft.test.tsx`.

---

## Implementation

### 1. Backend — read + publish commands (`core` + `src-tauri`)

In `core/src/fs_skills/mod.rs` (logic lives in the Tauri-free core per D-5):

- `read_skill_md(target_skills_root, dir_name) -> AppResult<String>` — read `<root>/<dir_name>/SKILL.md` to populate the editor when editing an existing skill.
- `publish_skill(target_skills_root, name, skill_md) -> AppResult<SkillDescriptor>` — mirror `install`'s order:
  1. `let conformance = conformance::evaluate(&skill_md, &name);`
  2. `if !conformance.is_installable() { return Err(AppError::ValidationFailed(conformance)); }` — **re-validation, same source of truth, P-6.**
  3. Write `<root>/<name>/SKILL.md` **atomically** (temp file + rename within the dir; reuse/extend the atomic helper alongside `atomic_install_dir`). Create the dir if new; if editing, overwrite only `SKILL.md` and leave any sibling resource files intact.
  4. Return `SkillDescriptor::read(&final_dir)`.

  Because the structured editor uses **one `name` field** as both the frontmatter `name` and the directory name, `name == parent_dir` (D-2) holds by construction — the form cannot desync them.

In `src-tauri/src/commands.rs`, add two `#[tauri::command] #[specta::specta]` wrappers and register them in `collect_commands!` (`src-tauri/src/lib.rs`):

```rust
#[tauri::command] #[specta::specta]
pub fn read_skill(target: TargetKind, dir_name: String) -> CmdResult<String> { ... }

#[tauri::command] #[specta::specta]
pub fn publish_skill(target: TargetKind, name: String, skill_md: String)
    -> CmdResult<SkillDescriptor> { ... }   // Err carries CommandError{ conformance } on ValidationFailed
```

`publish_skill`'s validation-failure error already flows through the existing
`CommandError { kind, message, conformance }` envelope — no new error plumbing.

### 2. Frontend — Craft screen + plumbing

**`src/api/client.ts`** — add:
```ts
readSkill: (target: TargetKind, dirName: string) => invoke<string>('read_skill', { target, dirName }),
publishSkill: (target: TargetKind, name: string, skillMd: string) =>
  invoke<SkillDescriptor>('publish_skill', { target, name, skillMd }),
```
(Bindings in `src/api/bindings.ts` regenerate on `bun run tauri dev`; no new hand types needed — `Conformance`/`SkillDescriptor` already exist.)

**Frontmatter (de)serialization** — add the `yaml` dep (`bun add yaml`, per P-9) and a small `src/craft/skillmd.ts` helper:
- `assembleSkillMd(fields, body): string` — serialize fields to YAML between `---` fences, append body. Using a real YAML serializer avoids hand-rolled quoting/escaping bugs.
- `parseSkillMd(text): { fields, body }` — split the frontmatter fence, `yaml.parse` it, return remainder as body (for the edit-existing case). Tolerant: malformed/missing frontmatter → empty fields + whole text as body.

**`src/screens/CraftScreen.tsx`** (new; follow `LibraryScreen.tsx` idioms — `inTauri()` guard, `cancelled` flag, `.screen` wrapper):
- Local state: `{ name, description, license, compatibility, body, conformance, publishError, publishing }`.
- On mount: if `AppContext.editing` is set, `api.readSkill(...)` → `parseSkillMd` → populate fields; else start blank.
- On any field/body change: assemble `SKILL.md`, **debounced** call `api.checkConformance(assembled, name)` → store `conformance`.
- **Inline failing-rule display:** show `<ConformanceBadge conformance={conformance}/>` plus a per-field findings list (group `findings` by `field`, render each `message` next to its field — the "display the failing rule inline" half of the outcome). Reuse `.badge-invalid`/`--red` tokens.
- **Publish button:** `disabled={publishing || conformance?.verdict === 'invalid'}` (the gate — blocks on `Invalid`, allows `Warnings`, matching `is_installable`). On click: `api.publishSkill(activeTarget, name, assembled)`; on `ValidationFailed` error, surface `err.conformance` inline (defense in depth).

**Navigation wiring:**
- `src/components/Tabs.tsx` — set the `craft` entry `enabled: true`, drop the `note`.
- `src/App.tsx` — add `case 'craft': return <CraftScreen />`.
- `src/state/AppContext.tsx` — add `editing: { target: TargetKind; dirName: string } | null` + `setEditing` to the context (mirrors the existing `tab`/`activeTarget` `useState`/`useCallback` shape).
- `src/screens/LibraryScreen.tsx` — add an **"Edit in Craft"** action per skill: `setEditing({ target: activeTarget, dirName })` then `setTab('craft')`. (Satisfies the "edit existing" scope.)

### 3. Test infrastructure (vitest, via bun — P-9)

- `bun add -d vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom` (reuse the existing `@vitejs/plugin-react`).
- Add a `test` block to `vite.config.ts` (`environment: 'jsdom'`, `globals: true`, a `setupFiles` that imports `@testing-library/jest-dom`).
- `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

### 4. The outcome test — `src/screens/Craft.test.tsx`

Pins the EARS outcome (`-t "blocks publish on invalid frontmatter"`):
- Render `<CraftScreen/>` inside `AppProvider`; `vi.spyOn(api, 'checkConformance').mockResolvedValue({ verdict: 'invalid', findings: [{ field: 'name', severity: 'error', code: 'name.dir_mismatch', message: '...' }] })`.
- Drive an edit, await the debounce, then assert: (a) the Publish button is **disabled**, and (b) the failing rule's `message` is **rendered inline**.
- Add a sibling positive test (valid frontmatter → button enabled) to prevent a trivially-passing gate.

---

## Files

| Action | Path |
|---|---|
| add | `core/src/fs_skills/mod.rs` — `read_skill_md`, `publish_skill`, atomic-file write |
| edit | `src-tauri/src/commands.rs` — `read_skill`, `publish_skill` commands |
| edit | `src-tauri/src/lib.rs` — register both in `collect_commands!` |
| add | `src/screens/CraftScreen.tsx` |
| add | `src/craft/skillmd.ts` — assemble/parse helpers |
| add | `src/screens/Craft.test.tsx` |
| edit | `src/api/client.ts` — `readSkill`, `publishSkill` |
| edit | `src/state/AppContext.tsx` — `editing` state |
| edit | `src/components/Tabs.tsx` — enable craft tab |
| edit | `src/App.tsx` — craft case |
| edit | `src/screens/LibraryScreen.tsx` — "Edit in Craft" action |
| edit | `vite.config.ts`, `package.json` — vitest setup |

## Verification

1. **Outcome test (the EARS gate):**
   `bun run vitest run src/screens/Craft.test.tsx -t "blocks publish on invalid frontmatter"` → passes.
2. **Backend:** `cargo test -p core` (publish re-validation: invalid → `ValidationFailed`, no file written; valid → SKILL.md written atomically; editing leaves sibling files).
3. **Lint/build:** `bun run lint` and `bun run build` clean (P-9 / existing CI gates).
4. **Manual (Tauri MCP):** `bun run tauri dev`; open **Craft**; type a `name` that mismatches the spec (e.g. uppercase) → Publish disabled, `name.format` shown inline; fix it → badge goes Valid, Publish enabled; publish → skill appears in **Library** under the active target. From Library, "Edit in Craft" loads the existing SKILL.md back into the fields.
5. **Spec status:** run `/ls-check` to re-derive I-3 `status` from the now-passing outcome; log decisions via `/ls-decisions`.

## Notes / boundaries

- **Spec-file discipline:** do **not** hand-edit `specs/INTENT/` or `CONSTITUTION.md`; use `/ls-intent`, `/ls-check`, `/ls-constitution`. `DECISIONS.md` may be appended (with `[intent: I-3]`) or via `/ls-decisions`.
- **Single source of truth:** all validation goes through `core::conformance::evaluate`. No new rules in the frontend — the UI only *renders* `Finding`s.
- **Out of scope (I-3 non-goals):** remote publish/registry, the I-1 shop/install pipeline, analytics (I-2), sync (I-4), AI-assisted authoring, and managing non-`SKILL.md` resource files.
