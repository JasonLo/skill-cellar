---
id: I-6
title: Surface plugin-managed skills
slug: surface-plugin-managed-skills
status: complete
opened: 2026-05-31
closed: 2026-05-31
superseded_by: null
verdict_outcomes_passed: 3
verdict_outcomes_passed_by_test: 3
verdict_outcomes_total: 3
verdict_checked_at: 2026-05-31T13:39:36Z
---

# Intent: Surface plugin-managed skills

- **Author:** Jason Lo
- **Last updated:** 2026-05-31

## Problem

The Library surfaces only project- and global-installed skills (`.claude/skills/<name>/`). Skills delivered through Claude Code's plugin system live under `~/.claude/plugins/` at variable depths (`*/skills/<name>/SKILL.md`) and never appear in the Library, so a user cannot see which plugin skills they have, whether each conforms to the agentskills.io spec, or how often it is used. The same skill is also mirrored across `cache/`, `marketplaces/`, and `external_plugins/`, so a raw file count overstates the real number (e.g. 53 files for 42 distinct skills).

## Outcome

- **WHEN** the Library loads **THE SYSTEM SHALL** discover every skill under `~/.claude/plugins/` whose path matches `*/skills/<name>/SKILL.md` at any depth and include them as a read-only `plugin` source. [test: vitest:src/core/fs-skills/plugins.test.ts -t "discovers nested plugin skills"]
- **WHEN** the same skill name exists in more than one plugin location **THE SYSTEM SHALL** return exactly one descriptor for that name, carrying a single source-plugin label. [test: vitest:src/core/fs-skills/plugins.test.ts -t "dedupes by name with source-plugin label"]
- **WHEN** a plugin skill is shown **THE SYSTEM SHALL** display a conformance verdict derived from its `SKILL.md` frontmatter using the same rules as project and global skills. [test: vitest:src/core/fs-skills/plugins.test.ts -t "plugin descriptor carries conformance verdict"]

## Non-Goals

- Installing, editing, or removing plugin skills from skill-cellar — the Claude Code plugin system remains their source of truth (extends I-1's "plugin-marketplace installs" non-goal).
- Managing plugin marketplaces or invoking `/plugin`.
- Determining which mirrored location is "authoritative" beyond picking one representative copy for display.
- Syncing plugin-skill state — I-4 governs egress; only derived usage metadata may ever sync.

## Constraints

- OpenTUI on Bun + React + TypeScript via OpenTUI's React reconciler; no Vite, Rust, or Python (P-1/P-2/P-3/P-9).
- Read-only: `~/.claude/plugins/` is added as a third allowed skill root for **reads only**; all writes remain confined to the project and global roots, honoring P-12's prohibition on unscoped filesystem access.
- The filesystem remains the single source of truth (P-5); the project MUST NOT maintain a separate database of plugin-skill state.
- The dedup key is the skill's `SKILL.md` frontmatter `name` (falling back to its directory name), matching how the Library already identifies skills.
- Conformance reuses the existing `evaluate` engine; plugin skills are not held to a stricter or looser bar than project/global skills.

## Change Log
- **2026-05-31** — Initial draft.
