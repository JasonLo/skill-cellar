# 🍷 skill-cellar

A desktop GUI for managing AI-agent skills. Shop for skills, install them into a project
or your global skill directory, see which ones actually get used, and craft your own —
all conformant to the [agentskills.io specification](https://agentskills.io/specification).

skill-cellar is the graphical companion to the
[`skill-sommelier`](https://github.com/JasonLo/skill-sommelier) plugin: it wraps
sommelier's *management* capabilities (discover, install, craft) in a UI and adds usage
analytics and a curated shop.

> **Status:** early development. The Rust core (conformance, atomic install, offline
> registry, usage analytics) is implemented and tested, and the Tauri shell builds; the
> React UI is scaffolded. Install from a local folder works today; shop install from
> GitHub and the Craft editor are not yet wired (see the roadmap). The authoritative spec
> lives under [`specs/`](specs/): non-negotiable principles in
> [`CONSTITUTION.md`](specs/CONSTITUTION.md) and product scope per intent in
> [`INTENT/`](specs/INTENT/).

## What it does

- **🛒 Shop** — browse a curated registry of vetted skills and search GitHub for more,
  then install with one click into the project or global directory you've selected.
- **📚 Library** — see everything installed in the active project (`.claude/skills/`) and
  your global directory (`~/.claude/skills/`); update or uninstall; spot skills that are
  installed but never used.
- **📊 Usage** — skill-cellar reads your local Claude Code transcripts and shows how often
  each skill actually fires, per project and over time — analytics over logs you already
  have. Cross-device sync of your usage metadata is **opt-in and off by default** (via
  Turso/libSQL); nothing leaves your machine unless you enable it, and transcript content
  never does.
- **🔨 Craft** — scaffold a new skill and edit its frontmatter and body with live spec
  validation, so what you write is conformant before you ship it.
- **✅ Conformance everywhere** — every skill, in the shop or your library, carries a
  spec-conformance verdict.

## What it does *not* do (v1)

skill-cellar is a **librarian, not an agent runner**. It manages skill *files*; it does not
execute agent workflows (diagnosing bugs, autoresearch, etc.) — those still run inside
Claude Code. The filesystem is the single source of truth; there's no hidden database of
installed state. Running workflows, plugin-marketplace installs, and registry publishing are
possible future work, not v1.

## How a skill is structured

A skill is a directory whose `SKILL.md` carries YAML frontmatter:

```
my-skill/
├── SKILL.md          # required: frontmatter + instructions
├── scripts/          # optional: executable code
├── references/       # optional: docs loaded on demand
└── assets/           # optional: templates, data
```

```markdown
---
name: my-skill          # ≤64 chars, lowercase/digits/hyphens, must match the folder name
description: What this skill does and when to use it.   # ≤1024 chars
---

Instructions for the agent…
```

Optional frontmatter fields: `license`, `compatibility`, `metadata`, `allowed-tools`. See
the [agentskills.io spec](https://agentskills.io/specification) for the full rules.

## Tech stack

- **[Tauri v2](https://tauri.app)** desktop shell — Rust core, native webview.
- **React + TypeScript + Vite** frontend (top tabs: Shop · Library · Usage · Craft, with a
  project picker and `global` toggle in the title bar).
- **Rust** backend commands for file I/O, registry/GitHub fetch, transcript parsing, and
  spec validation. (No Python — Tauri's backend is Rust, and v1's backend work is light
  enough that Rust is the cleanest fit.)
- **Turso (libSQL)** for optional, opt-in cross-device sync of usage metadata — off by
  default and local-first; transcript content is never synced.

## Development

skill-cellar is a Bun-managed frontend (Vite + React + TypeScript) wrapped in a Tauri
v2 shell, with the testable logic kept in a dependency-light Rust `core` crate. Day-to-day
work happens in two layers: the Vite dev server (fast, browser-like) and the full native
shell (slower, needs system libraries).

### Prerequisites

- **[Bun](https://bun.sh)** — package manager and runtime for the frontend.
- **Rust** via [`rustup`](https://rustup.rs), stable toolchain. The Tauri crates' library
  MSRV is 1.77.2; in practice use a recent stable (the `tauri` CLI itself wants a newer
  toolchain on some platforms).
- **System libraries for the native shell** (Linux/WSL2 example):
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev libdbus-1-dev build-essential curl \
    wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  ```
  macOS needs `xcode-select --install`; Windows needs the MS C++ Build Tools and WebView2.
  See [`src-tauri/README.md`](src-tauri/README.md) for the full native-build notes (WSLg,
  blank-window workarounds, icon generation).

### Everyday commands

```bash
bun install          # install frontend deps (run once)

bun run dev          # Vite dev server only (http://localhost:5173) — fast UI loop
bun run tauri:dev    # full app: Vite + compile Rust shell + open the window
bun run build        # type-check (tsc -b) + production frontend bundle
bun run tauri:build  # bundle the distributable desktop app
bun run lint         # Biome: lint + format + import-order check (read-only, CI-safe)
bun run format       # Biome: apply fixes, format, and organize imports in place

cargo test --manifest-path core/Cargo.toml   # Rust logic tests (no Tauri/network needed)
```

`bun run tauri:dev` runs the frontend's `beforeDevCommand` (`bun run dev`), waits for Vite,
compiles the Rust shell, then opens a webview pointed at the dev server. You get Vite HMR on
the React side; Tauri rebuilds and restarts the Rust process when backend files change.

### How the crates fit together

- **`core/`** — pure Rust: agentskills.io conformance, atomic install, registry cache. No
  Tauri or network dependencies, so it builds and `cargo test`s anywhere — it's where logic
  is verified.
- **`src-tauri/`** — the desktop shell. Exposes `core` to the frontend over Tauri IPC and
  adds the live HTTP fetcher. Heavier build (links the native webview).
- **Type-safe IPC** — `src/api/bindings.ts` is generated from the Rust `#[tauri::command]`
  functions by [tauri-specta](https://github.com/specta-rs/tauri-specta) on each debug
  build; don't hand-edit it once the shell builds.

### Not yet wired up

Frontend lint and formatting are handled by [Biome](https://biomejs.dev) (`biome.json`) —
one tool for linting, formatting, and import ordering, with `recommended` rules plus the
`react` domain. The generated `src/api/bindings.ts` is excluded. Planned quality gates not
yet in the repo:

- **Rust lints** — `cargo fmt` and `cargo clippy` (Biome covers the frontend; these would
  cover the Rust side).
- **Frontend tests** — [Vitest](https://vitest.dev) + React Testing Library, with a thin
  Playwright end-to-end layer.
- **CI** — a GitHub Actions matrix build via the official
  [`tauri-action`](https://github.com/tauri-apps/tauri-action) plus a fast lint/test job,
  caching the Cargo target with `Swatinem/rust-cache`.
- **Git hooks** — Lefthook (one config across Rust + TS) or husky + lint-staged.

## Roadmap

- **v1** — Shop, Library, Usage, Craft, conformance verdicts (this design).
- **Later** — run workflows by handing off to Claude Code; plugin-marketplace installs;
  publish skills to a shared registry.

## License

[MIT](LICENSE).
