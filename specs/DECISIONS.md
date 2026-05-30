# Decisions Log

Append-only log of non-trivial decisions. Each entry: `- **D-N:** Decided X because Y (YYYY-MM-DD). [intent: I-N]`

- **D-1:** Reimplement agentskills.io conformance natively in Rust instead of shelling out to skills-ref, because P-2 forbids Python and offline use needs no external validator (2026-05-29). [intent: I-1]
- **D-2:** Validate the `name == parent_dir` rule against the install destination (the frontmatter `name`) at install time, because that is the directory actually created (2026-05-29). [intent: I-1]
- **D-3:** Abstract install behind a `SkillSource` trait with a local-dir source now, deferring live GitHub fetch, because it keeps install tests hermetic and offline (2026-05-29). [intent: I-1]
- **D-4:** Generate TypeScript IPC types from Rust via tauri-specta behind an optional `specta` feature, because one source of truth prevents drift without burdening core builds (2026-05-29). [intent: I-1]
- **D-5:** Split the backend into a Tauri-free `core` crate plus a `src-tauri` shell, because the EARS-pinned logic must build and test without the webview toolchain (2026-05-29). [intent: I-1]
- **D-6:** Adopt bun as the JS toolchain (per P-9) and delete `package-lock.json` in favor of `bun.lock`, rewiring `tauri.conf.json` before-commands and docs from `npm`/`pnpm`/`npx` to `bun`/`bunx`, because a single package/script/test runner removes npm-lockfile drift; verified `bun install`, `bun run lint`, and `bun run build` all pass (2026-05-29). [intent: I-1]
- **D-7:** Group usage analytics by the `cwd` recorded on each transcript line rather than by decoding the `~/.claude/projects/<folder>` name, because the folder encoding (slash→hyphen) is lossy and ambiguous while `cwd` is the authoritative working directory (2026-05-29). [intent: I-2]
- **D-8:** Parse transcripts tolerantly as generic `serde_json::Value`, skipping any line that fails to parse or isn't a Skill-bearing assistant line, because transcripts are an external, evolving format and read-only analytics must never crash on a malformed line (2026-05-29). [intent: I-2]
