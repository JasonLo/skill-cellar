# Constitution: skill-cellar

Ratified: 2026-05-29

Non-negotiable project principles. Every other `spec-` skill validates its output against this file and refuses to produce violating output.

## Stack choice

- **P-1:** The desktop shell SHALL be built with Tauri v2 (Rust core, native webview).
- **P-2:** The backend SHALL be written in Rust; the project MUST NOT introduce a Python backend.
- **P-3:** The frontend SHALL be built with React, TypeScript, and Vite.
- **P-4:** Optional cross-device sync, when enabled, SHALL use Turso (libSQL); the app SHALL remain fully functional offline with sync disabled (local-first).

## Architecture

- **P-5:** The filesystem (skill directories) SHALL be the single source of truth for installed-skill state; the project MUST NOT maintain a separate database of installed-skill state. The optional sync store holds only derived usage metadata, never authoritative installed state.

## File format

- **P-6:** A skill SHALL be validated against the agentskills.io specification before install; the project MUST NOT install a skill whose `SKILL.md` frontmatter fails validation.

## Security

- **P-7:** Any data leaving the device SHALL be opt-in and off by default; the app MUST NOT transmit data until the user explicitly enables sync.
- **P-8:** Only usage metadata (skill names, invocation counts, timestamps, app and skill versions) MAY be synced; the app MUST NEVER transmit transcript content, prompts, file contents, or file paths.

## Amendments

- **2026-05-29** — Initial constitution ratified.
