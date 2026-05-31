# Constitution: skill-cellar

Ratified: 2026-05-29

Non-negotiable project principles. Every other `spec-` skill validates its output against this file and refuses to produce violating output.

## Stack choice

- **P-1:** ~~The desktop shell SHALL be built with Tauri v2 (Rust core, native webview).~~ [superseded 2026-05-30] The application SHALL be a terminal UI built with OpenTUI on the Bun runtime.
- **P-2:** ~~The backend SHALL be written in Rust; the project MUST NOT introduce a Python backend.~~ [superseded 2026-05-30] The backend SHALL be written in TypeScript and run on Bun; the project MUST NOT introduce a Rust or Python backend.
- **P-3:** ~~The frontend SHALL be built with React, TypeScript, and Vite.~~ [superseded 2026-05-30] The UI SHALL be built with React and TypeScript via OpenTUI's React reconciler; the project MUST NOT use Vite or another browser bundler.
- **P-4:** Optional cross-device sync, when enabled, SHALL use Turso (libSQL); the app SHALL remain fully functional offline with sync disabled (local-first).
- **P-9:** The JS toolchain (package manager, script runner, and test runner) SHALL be bun; the project MUST NOT use npm/yarn/pnpm for installs or scripts.

## Architecture

- **P-5:** The filesystem (skill directories) SHALL be the single source of truth for installed-skill state; the project MUST NOT maintain a separate database of installed-skill state. The optional sync store holds only derived usage metadata, never authoritative installed state.
- **P-14:** ~~Filesystem, conformance-validation, catalog-fetch, and sync logic SHALL reside in the Rust core and be reached only through typed IPC commands; the frontend MUST NOT be granted raw filesystem, shell, or HTTP plugin permissions to perform this work itself.~~ [retired 2026-05-30, reason: Tauri-specific. Under OpenTUI/Bun there is no Rust core and no plugin permission system — the Bun process holds full host capabilities. Trust-boundary protection is now expressed via P-12 (path scoping) and P-6 (agentskills.io validation).]

## File format

- **P-6:** A skill SHALL be validated against the agentskills.io specification before install; the project MUST NOT install a skill whose `SKILL.md` frontmatter fails validation.

## Security

- **P-7:** Any data leaving the device SHALL be opt-in and off by default; the app MUST NOT transmit data until the user explicitly enables sync.
- **P-8:** Only usage metadata (skill names, invocation counts, timestamps, app and skill versions) MAY be synced; the app MUST NEVER transmit transcript content, prompts, file contents, or file paths.
- **P-10:** ~~Every IPC command exposed to the webview SHALL be granted through an explicit capability scoped to the narrowest window and permission set required; the project MUST NOT grant a command or plugin permission application-wide when a single window needs it.~~ [retired 2026-05-30, reason: Tauri-specific. OpenTUI runs in a single Bun process with no webview/IPC boundary, so the capability model is inapplicable.]
- **P-11:** ~~Production builds SHALL ship a restrictive `Content-Security-Policy`; the project MUST NOT set `"csp": null` outside local development.~~ [retired 2026-05-30, reason: Tauri-specific. No webview means no CSP applicable.]
- **P-12:** ~~Any command that reads or writes the filesystem on behalf of the frontend SHALL validate every path against the allowed skill roots (project and global) before access; the project MUST NEVER perform unscoped filesystem access on behalf of the webview.~~ [superseded 2026-05-30] Any filesystem read or write SHALL validate the target path against the allowed skill roots (project and global) before access; the project MUST NEVER perform unscoped filesystem access on behalf of the user.
- **P-13:** If an auto-updater is shipped, update artifacts SHALL be cryptographically signed and served only over HTTPS; the signing private key MUST NEVER be committed to the repository and SHALL be supplied via a build-time secret/environment variable.

## Amendments

- **2026-05-29** — Initial constitution ratified.
- **2026-05-29** — Added P-9 (Stack choice): the JS toolchain SHALL be bun; npm/yarn/pnpm forbidden for installs and scripts. Reason: lock in the package/script/test runner at the same tier as P-3 (React/TS/Vite); npm lockfiles/configs become redundant.
- **2026-05-29** — Added P-10–P-13 (Security) and P-14 (Architecture): Tauri v2 engineering guardrails — least-privilege capabilities (P-10), strict CSP / no `csp: null` in production (P-11), filesystem path-scope confinement (P-12), signed HTTPS-only updates (P-13), and Rust-owns-the-IPC-boundary (P-14). Reason: Tauri v2's security model is opt-in by default; these lock in the framework-level posture for a librarian app rendering third-party skill content. A proposed P-15 (cargo/bun dependency-audit CI gate) was considered and skipped.
- **2026-05-30** — Replaced Tauri with OpenTUI as the application substrate. Modified P-1 (Tauri→OpenTUI on Bun), P-2 (Rust backend→TypeScript on Bun; Rust now forbidden alongside Python), P-3 (dropped Vite, React via OpenTUI's reconciler), P-12 (rephrased to single-process model — no frontend/webview qualifier). Retired P-10, P-11, P-14 as Tauri-specific (capabilities, CSP, IPC boundary). P-13 untouched (conditional on shipping an updater; may never fire under bun-distributed binaries). Reason: full substrate replacement per `/spec-constitution Replace Tauri to OpenTUI`. Cascade: I-1/I-2/I-3/I-4 constraint lines refer to "Tauri v2 (Rust core) + React/TypeScript/Vite" and need refining via `/spec-intent refine`; `src-tauri/`, `core/Cargo.toml`, `vite.config.ts`, `index.html` become removable; React tree migrates from DOM to OpenTUI components.
