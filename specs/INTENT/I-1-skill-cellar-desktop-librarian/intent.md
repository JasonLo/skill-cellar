---
id: I-1
title: skill-cellar desktop librarian
slug: skill-cellar-desktop-librarian
status: draft
opened: 2026-05-29
closed: null
superseded_by: null
verdict_outcomes_passed: 0
verdict_outcomes_passed_by_agent: 0
verdict_outcomes_passed_by_test: 0
verdict_outcomes_total: 5
verdict_checked_at: 2026-05-30T01:08:46Z
---

# Intent: skill-cellar desktop librarian

- **Author:** Jason Lo
- **Last updated:** 2026-05-29

## Problem

Managing AI-agent skills today is CLI- and filesystem-only: installing or pruning a skill means hand-editing `.claude/skills/` directories, and knowing which installed skills actually get used means reading transcripts by hand. There is no GUI to browse installable skills, verify spec conformance, or see real usage. skill-sommelier covers discovery and crafting as agent workflows but offers no visual management surface.

## Outcome

- **WHEN** a user installs a skill from the shop **THE SYSTEM SHALL** validate it against the agentskills.io spec and copy it into the active target's `.claude/skills/<name>/` atomically, leaving no partial directory if validation or copy fails. [test: cargo:install_atomic_validates_then_copies]
- **WHEN** a skill is shown in the shop or library **THE SYSTEM SHALL** display a conformance verdict of valid, warnings, or invalid derived from its `SKILL.md` frontmatter rules. [test: cargo:conformance_verdict_from_frontmatter]
- **WHEN** the Usage screen is opened **THE SYSTEM SHALL** report per-skill invocation counts parsed from local Claude Code JSONL transcripts, grouped by project. [test: cargo:usage_counts_skill_invocations_by_project]
- **IF** the GitHub API is unreachable **THEN THE SYSTEM SHALL** fall back to the cached registry so the Featured shop stays usable. [test: cargo:registry_falls_back_to_cache_when_offline]
- **WHILE** editing a skill in Craft **THE SYSTEM SHALL** block publish or install of a skill whose frontmatter fails spec validation and display the failing rule inline. [test: vitest:src/screens/Craft.test.tsx -t "blocks publish on invalid frontmatter"]

## Non-Goals

- Running agent workflows (diagnose, autoresearch, etc.) — those remain in Claude Code; skill-cellar manages skill *files*, it does not launch an agent.
- Plugin-marketplace (`/plugin`) installs.
- Publishing skills to a shared registry.
- Non-Claude / other-agent skill formats.
- A Python backend, and any telemetry or network tracking beyond reading local transcripts.

## Constraints

- Tauri v2 shell (Rust core, native webview) + React + TypeScript + Vite frontend; no Python.
- The filesystem (skill directories) is the single source of truth — no hidden database of installed state.
- Usage analytics are read-only over existing transcripts; no new instrumentation.
- Conformance mirrors the official `skills-ref` rules (`name` ≤64 chars and matches the parent dir; `description` 1–1024 chars).

## Change Log
- **2026-05-29** — Initial draft.
