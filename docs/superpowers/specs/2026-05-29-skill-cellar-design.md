# skill-cellar — design spec

**Date:** 2026-05-29
**Status:** Approved (brainstorming) — ready for implementation planning

## 1. Summary

skill-cellar is a Tauri desktop application that acts as a **librarian for AI-agent
skills**. It lets a user shop for skills, install them into a chosen project or their
global skill directory, see which installed skills actually get used, and craft/edit
their own skills — all conformant to the [agentskills.io specification](https://agentskills.io/specification).

It wraps the *management-oriented* capabilities of the
[`skill-sommelier`](https://github.com/JasonLo/skill-sommelier) plugin (discover, install,
craft) in a GUI, and adds usage analytics and a curated shop.

## 2. Scope

### In scope (v1)

- **Shop** — browse a curated registry and search GitHub for installable skills; install
  into the active target.
- **Library** — view/update/uninstall skills installed in the active project and in the
  global skill directory.
- **Usage analytics** — parse local Claude Code transcripts and report how often each
  skill is actually invoked, by project and over time.
- **Craft** — scaffold a new skill and edit its frontmatter/body with live spec validation.
- **Spec conformance** — every skill shown carries a conformance verdict.

### Out of scope (v1) — possible future work

- Running agent workflows (diagnose, autoresearch, etc.). Those remain in Claude Code.
  skill-cellar manages skill *files*; it does not launch an agent.
- Plugin-marketplace (`/plugin`) installs.
- Publishing to a shared registry.
- Non-Claude / other-agent skill formats.

### Deliberate boundary

**v1 is a librarian, not an agent runner.** The filesystem (skill directories) is the single
source of truth; there is no hidden database of installed state.

## 3. Tech stack

- **Shell:** Tauri v2 (Rust core, native webview).
- **Frontend:** React + TypeScript + Vite. Layout: title-bar project picker + `global`
  toggle, top tabs for **Shop · Library · Usage · Craft**.
- **Backend:** Rust modules exposed to the frontend via Tauri `invoke` commands. No Python.
- **External services:** GitHub REST/search API; a curated-registry JSON manifest hosted in
  a maintained repo; optional shell-out to the official
  [`skills-ref`](https://github.com/agentskills/agentskills/tree/main/skills-ref) validator.

### Note on Tauri + Python

Tauri's backend is Rust, not Python. Because v1's backend work is light (file I/O, JSONL
parsing, HTTP), the backend is written directly in Rust — the cleanest, smallest, most
idiomatic Tauri path. (Python via sidecar or PyTauri was considered and rejected for v1 to
avoid bundling a Python runtime and extra IPC glue.)

## 4. Components

### Rust backend modules (each behind focused Tauri commands)

| Module | Responsibility |
|--------|----------------|
| `fs_skills` | Discover/read/write/copy skill dirs in project `.claude/skills/` and global `~/.claude/skills/`. Install = fetch + validate + atomic copy. |
| `registry` | Fetch & cache the curated-registry manifest. |
| `github` | Search GitHub for repos/dirs containing `SKILL.md`; fetch and dedupe against the registry. |
| `conformance` | Validate a skill against the agentskills.io spec (frontmatter rules; `name` matches parent dir). Verdict: ✅ valid / ⚠️ warnings / ❌ invalid. |
| `usage` | Parse `~/.claude/projects/**/*.jsonl`; count `Skill` tool invocations per skill, by project and time. |
| `projects` | Track the active target project and a recents list. |

### Frontend screens

- **Shop** — Featured shelf (registry) + GitHub search; each result is a card with a
  conformance badge and an Install action.
- **Library** — skills installed in the active target and global, with update/uninstall;
  cross-references usage to flag "installed but never fired."
- **Usage** — dashboard: most/least used, unused-but-installed, invocation trend.
- **Craft** — new-skill scaffold + frontmatter editor + live conformance validation
  (wraps the spirit of `ss-skill-craft`).

## 5. Data flow

- **Shop → install:** registry + GitHub results → user clicks Install → backend fetches
  the skill dir → `conformance` validates → atomic copy into the active target's
  `.claude/skills/<name>/` → Library refreshes.
- **Usage:** on open/refresh, `usage` scans transcripts → aggregates counts → Usage
  dashboard; Library cross-references aggregates to surface unused installs.
- **Craft:** editor writes a skill dir → live `conformance` check → (future) publish to the
  registry repo.

## 6. Data & storage

- **Source of truth:** the filesystem (skill directories). No hidden DB of installed state.
- **App-local cache** (Tauri app-data dir): registry snapshot, GitHub result cache, parsed
  usage aggregates (invalidated by transcript file mtime), recents list, settings.

## 7. Spec conformance

A skill is conformant when its `SKILL.md` has valid YAML frontmatter:

- **`name`** (required): ≤64 chars, lowercase letters/digits/hyphens only, no leading/
  trailing/consecutive hyphen, and **must match the parent directory name**.
- **`description`** (required): 1–1024 chars, non-empty.
- Optional: `license`, `compatibility` (≤500 chars), `metadata` (string map),
  `allowed-tools` (experimental).

Directory shape: `skill-name/SKILL.md` (required) plus optional `scripts/`, `references/`,
`assets/`. The `conformance` module mirrors the `skills-ref` rules; Craft blocks
publish/install of invalid skills with inline errors.

## 8. Error handling

- **Network/GitHub failures** degrade to the cached registry — the Featured shop stays
  usable offline.
- **Install is atomic** — validate before copy; write to a temp dir then move; never leave a
  half-written skill directory.
- **Malformed transcripts** are skipped, not fatal.
- **Missing `~/.claude` directories** are handled gracefully with empty states.

## 9. Testing

- **Rust unit tests** per module: conformance rules, transcript-parsing fixtures, install
  atomicity against a temp dir.
- **Frontend component tests** for the four screens.
- **Golden fixtures:** a set of valid/invalid skills and sample transcripts as stable inputs.

## 10. Open questions / deferred

- Exact location and schema of the curated-registry manifest repo.
- Whether to bundle `skills-ref` or reimplement validation purely in Rust (design assumes
  Rust reimplementation with optional shell-out).
