# Decisions Log

Append-only log of non-trivial decisions. Each entry: `- **D-N:** Decided X because Y (YYYY-MM-DD). [intent: I-N]`

- **D-1:** Reimplement agentskills.io conformance natively in Rust instead of shelling out to skills-ref, because P-2 forbids Python and offline use needs no external validator (2026-05-29). [intent: I-1]
- **D-2:** Validate the `name == parent_dir` rule against the install destination (the frontmatter `name`) at install time, because that is the directory actually created (2026-05-29). [intent: I-1]
- **D-3:** Abstract install behind a `SkillSource` trait with a local-dir source now, deferring live GitHub fetch, because it keeps install tests hermetic and offline (2026-05-29). [intent: I-1]
- **D-4:** Generate TypeScript IPC types from Rust via tauri-specta behind an optional `specta` feature, because one source of truth prevents drift without burdening core builds (2026-05-29). [intent: I-1]
- **D-5:** Split the backend into a Tauri-free `core` crate plus a `src-tauri` shell, because the EARS-pinned logic must build and test without the webview toolchain (2026-05-29). [intent: I-1]
