# I-4 — Privacy & Sync Boundary (full vertical)

## Context

Cross-device sync is the one path by which data can leave the device, so the
constitution makes it opt-in and metadata-only (P-7, P-8) and local-first over
Turso/libSQL (P-4). I-4 pins two testable EARS outcomes:

1. `cargo:no_transmission_until_sync_enabled` — sync off ⇒ nothing leaves the device.
2. `cargo:sync_payload_metadata_only` — sync on ⇒ payload carries **only** usage
   metadata (skill names, counts, timestamps, app/skill versions); never
   transcript content, prompts, file contents, or **file paths**.

Today there is **no** sync code, **no** settings persistence, and **no** Turso
dependency. The blocker for P-8: existing usage data (`core/src/usage/mod.rs`)
is grouped by `ProjectUsage.project`, which is the raw `cwd` **file path**
(`usage/mod.rs:38,157`). That path must never cross the boundary.

**Decisions taken with the user (drive this plan):**
- **Full Turso/libSQL integration now** (not a deferred stub).
- **Per-project rows with hashed, non-reversible project IDs** (preserve
  per-project analytics without leaking paths).
- **Full vertical**: persisted opt-in setting (off by default) + IPC + Settings UI.

This scope exceeds I-4's current non-goals ("transport/provider choice … is a
non-goal"). Governance is handled in Step 0.

The architecture mirrors the existing `RegistryFetcher` (core trait) /
`HttpFetcher` (src-tauri impl) split (D-5): the **boundary + payload + gate live
in the Tauri-free `core` crate** (so the two EARS cargo tests stay hermetic and
offline), and the **live Turso transport lives in `src-tauri`**.

---

## Step 0 — Governance (do first, no code)

The expanded scope must be reflected in the human-owned specs before coding:
- **`/spec-intent`** — refine I-4: add a third EARS outcome for the Turso transport
  (e.g. *WHEN sync is enabled and a transport is configured THE SYSTEM SHALL
  upsert the metadata payload to the configured Turso database*) and relax the
  "transport choice is a non-goal" line. Do **not** edit `intent.md` directly.

---

## Backend — `core` crate (Tauri-free, pinned by cargo tests)

New module `core/src/sync/` (add `pub mod sync;` + re-exports to
`core/src/lib.rs:17-31`). All public types get the
`#[cfg_attr(feature = "specta", derive(specta::Type))]` treatment used
throughout `usage/mod.rs` so TS bindings generate (D-4).

### `core/src/sync/settings.rs`
- `SyncSettings { enabled: bool, turso_url: Option<String>, auth_token: Option<String>, device_id: String, project_salt: String }`.
  `Default` ⇒ `enabled: false` (satisfies P-7 off-by-default).
- `load(path) -> AppResult<SyncSettings>` (missing file ⇒ `Default`, mirroring the
  tolerant "missing ⇒ empty" pattern in `usage_report`), `save(path, &settings)`.
  Use serde_json; reuse `fs_skills::atomic::atomic_write_file` (D-11) for the write.
- `device_id` / `project_salt` are generated once at first save and **stay local**
  (never in the payload). Generation happens in `src-tauri` (core has no RNG; see
  note on `Date::now`/`random` being unavailable in this environment) and is
  passed in — keep core deterministic/testable.

### `core/src/sync/payload.rs`
- `SyncPayload { app_version: String, device_id: String, projects: Vec<ProjectMetric> }`
- `ProjectMetric { project_id: String, total: u64, skills: Vec<SkillMetric> }`
- `SkillMetric { skill: String, count: u64, version: Option<String> }`
- `build_sync_payload(report: &UsageReport, app_version, device_id, salt, skill_versions) -> SyncPayload`
  — maps each `ProjectUsage` to a `ProjectMetric`, replacing `project` (the cwd
  **path**) with `project_id = hash(salt, path)`. **The path itself is dropped and
  never stored on the struct** — P-8 holds by construction (the type has no path
  field, mirroring how D-11 made `name == parent_dir` true by construction).
- `project_id`: `SHA-256(salt || cwd)` hex, truncated (e.g. 16 bytes). Salt makes
  it non-dictionary-reversible. Add `sha2` to `core/Cargo.toml`.
- Optional `skill_versions: &HashMap<String,String>` from installed-skill
  frontmatter (`conformance::frontmatter`) for `SkillMetric.version`; omit when unknown.

### `core/src/sync/transport.rs`
- `pub trait SyncTransport { fn transmit(&self, payload: &SyncPayload) -> AppResult<()>; }`
- `pub fn sync_usage(settings: &SyncSettings, report: &UsageReport, app_version, skill_versions, transport: &dyn SyncTransport) -> AppResult<Option<SyncPayload>>`
  — **the gate**: `if !settings.enabled { return Ok(None) }` (no transmit call at
  all), else build payload, `transport.transmit(&payload)?`, return `Ok(Some(payload))`.

### `core/tests/sync.rs` (the two EARS outcomes)
Follow the fixture/assertion style of `core/tests/usage.rs`.
- `RecordingTransport { calls: Mutex<u32>, last: Mutex<Option<SyncPayload>> }` impl
  `SyncTransport`.
- **`no_transmission_until_sync_enabled`**: settings `enabled:false` ⇒
  `sync_usage(...)` returns `Ok(None)` and `RecordingTransport.calls == 0`.
  Also assert `enabled:true` does call transmit once (proves the gate is real).
- **`sync_payload_metadata_only`**: build a `UsageReport` whose projects use
  realistic cwd paths (e.g. `/home/alice/secret-project`) and skills; serialize the
  built payload to JSON and assert it contains **none** of those path substrings
  (`/home`, the cwd strings), and that each project row exposes only
  `{project_id,total,skills:[{skill,count,version?}]}` + top-level
  `{app_version,device_id}`. Assert `project_id != original path`.

---

## Backend — `src-tauri` (live Turso transport + IPC)

### `src-tauri/src/turso_sync.rs` (new)
- `TursoTransport { url, auth_token, runtime }` implementing `core::SyncTransport`.
  `libsql` client is async; hold a `tokio::runtime::Runtime` and `block_on` inside
  `transmit` (commands stay sync, matching `HttpFetcher`'s blocking style).
- On `transmit`: ensure schema then upsert. Minimal schema:
  `usage_metric(device_id, project_id, skill, count, version, app_version, updated_at, PRIMARY KEY(device_id, project_id, skill))`.
- Add to `src-tauri/Cargo.toml`: `libsql`, `tokio` (rt-multi-thread), `uuid` (v4,
  for generating `device_id`/`project_salt`).

### `src-tauri/src/state.rs`
- Add `pub sync_settings_path: PathBuf` and `pub sync: Mutex<SyncSettings>`.
- In `AppState::new` / setup (`lib.rs:71-82`): settings path under the existing
  `app_data_dir`; `load()` at startup; if `device_id`/`project_salt` empty,
  generate via `uuid`/random bytes and `save()`.

### `src-tauri/src/commands.rs` (follow the `set_active_target`/`get_active_target` pattern, `commands.rs:103-114`; each `#[tauri::command] #[specta::specta]`, returns `CmdResult<T>`)
- `get_sync_settings(state) -> CmdResult<SyncSettings>` (consider redacting
  `auth_token` in the returned DTO — return a `bool has_token` instead of the secret).
- `set_sync_enabled(state, enabled) -> CmdResult<()>` — set + persist.
- `set_sync_config(state, turso_url, auth_token) -> CmdResult<()>` — set + persist.
- `sync_now(state) -> CmdResult<Option<SyncPayload>>` — build report via
  `usage_report` (reuse `get_usage` plumbing), construct `TursoTransport` from
  settings, call `core::sync_usage`. Returns the payload (or `None` if disabled).
- Register all in `tauri_specta::collect_commands!` (`lib.rs:25-35`).

### Security notes
- **No new capability or plugin permission** needed: these are app commands
  exposed through the invoke handler, and all FS/network work stays in Rust core
  (P-14, P-10). `capabilities/default.json` is untouched.
- `auth_token` stored in the local settings JSON under `app_data_dir` (pragmatic
  desktop default). It is **auth**, never part of the payload. Note as a tradeoff;
  OS-keychain storage is out of scope.

---

## Frontend — Settings surface + opt-in toggle

- `src/state/AppContext.tsx` — add `'settings'` to the `Tab` union.
- `src/components/Tabs.tsx` — add `{ id: 'settings', label: 'Settings', enabled: true }`.
- `src/App.tsx` — add the `case 'settings'` to `ActiveScreen()` (`App.tsx:9-27`).
- `src/screens/SettingsScreen.tsx` (new) — reuse the **aria-pressed toggle** pattern
  from `TitleBar.tsx:22-49` for sync on/off; reuse the `Field` text-input pattern
  from `CraftScreen.tsx:204-256` for Turso URL + auth token; a "Sync now" button +
  status line. Plain CSS in `src/index.css` matching existing variables.
- `src/api/client.ts` — add `getSyncSettings`, `setSyncEnabled`, `setSyncConfig`,
  `syncNow` wrappers (`bindings.ts` regenerates from specta on the debug build).
- `src/screens/Settings.test.tsx` (new, vitest + Testing Library per D-12, style of
  `Craft.test.tsx`) — toggle renders **off by default**; toggling calls
  `api.setSyncEnabled(true)`. (No EARS is pinned to a frontend test; this is
  guardrail coverage.)

---

## Verification

1. **EARS (authoritative):** `cargo test -p skill-cellar-core sync` — both
   `no_transmission_until_sync_enabled` and `sync_payload_metadata_only` pass.
2. `cargo build` (workspace) and `cargo build -p skill-cellar --no-default-features`
   to confirm Turso deps don't leak into a feature-gated path unexpectedly.
3. `bun run test` (vitest) and `bun run build` (frontend + `tsc -b`) pass.
4. **Manual via the dev MCP bridge (D-13):** `bun run tauri:dev`; with sync **off**,
   monitor IPC/network and confirm `sync_now` returns `None` and no request leaves;
   enter a real Turso URL + token, enable sync, click "Sync now", confirm
   `usage_metric` rows appear in the Turso DB and contain **no** path strings.
5. `/spec-check` — derive I-4 status from outcome pass-counts (writes
   `intent.md` frontmatter); confirm the two (now three) outcomes register.

---

## Out of scope / flagged
- **Pre-existing P-11 drift:** `src-tauri/tauri.conf.json` sets `"csp": null` in
  production. Not an I-4 outcome (it's I-1/general). Flagged, not fixed here.
- Account systems, auth, multi-user sharing (I-4 non-goal).
- Changing I-2 usage-counting logic (I-4 non-goal) — sync reads its output only.
