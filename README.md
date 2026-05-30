# 🍷 skill-cellar

A desktop GUI for managing AI-agent skills. Shop for skills, install them into a project
or your global skill directory, see which ones actually get used, and craft your own —
all conformant to the [agentskills.io specification](https://agentskills.io/specification).

skill-cellar is the graphical companion to the
[`skill-sommelier`](https://github.com/JasonLo/skill-sommelier) plugin: it wraps
sommelier's *management* capabilities (discover, install, craft) in a UI and adds usage
analytics and a curated shop.

> **Status:** in design. This README describes the intended v1. See
> [`docs/superpowers/specs/2026-05-29-skill-cellar-design.md`](docs/superpowers/specs/2026-05-29-skill-cellar-design.md)
> for the full design spec.

## What it does

- **🛒 Shop** — browse a curated registry of vetted skills and search GitHub for more,
  then install with one click into the project or global directory you've selected.
- **📚 Library** — see everything installed in the active project (`.claude/skills/`) and
  your global directory (`~/.claude/skills/`); update or uninstall; spot skills that are
  installed but never used.
- **📊 Usage** — skill-cellar reads your local Claude Code transcripts and shows how often
  each skill actually fires, per project and over time. No new tracking, no telemetry —
  just analytics over logs you already have.
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

## Development

> Project scaffolding is not in place yet. Once it is, this section will document the
> `pnpm`/`cargo` install and `pnpm tauri dev` workflow.

## Roadmap

- **v1** — Shop, Library, Usage, Craft, conformance verdicts (this design).
- **Later** — run workflows by handing off to Claude Code; plugin-marketplace installs;
  publish skills to a shared registry.

## License

[MIT](LICENSE).
