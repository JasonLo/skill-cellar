---
id: I-3
title: Craft skill editor
slug: craft-skill-editor
status: draft
opened: 2026-05-29
closed: null
superseded_by: null
verdict_outcomes_passed: 0
verdict_outcomes_passed_by_agent: 0
verdict_outcomes_passed_by_test: 0
verdict_outcomes_total: 1
verdict_checked_at: 2026-05-29T20:25:00Z
---

# Intent: Craft skill editor

- **Author:** Jason Lo
- **Last updated:** 2026-05-29

## Problem

Authoring or editing a skill today means hand-editing `SKILL.md` and discovering spec violations only at install time — or never. There is no editing surface that validates frontmatter as you go and stops you from shipping a malformed skill, so invalid skills can be installed or "published" locally and fail silently later.

## Outcome

- **WHILE** editing a skill in Craft **THE SYSTEM SHALL** block publish or install of a skill whose frontmatter fails spec validation and display the failing rule inline. [test: vitest:src/screens/Craft.test.tsx -t "blocks publish on invalid frontmatter"]

## Non-Goals

- Publishing skills to a shared/remote registry — Craft writes locally only.
- The shop, install pipeline, and conformance-verdict display surface (I-1) — Craft reuses the same validation rules but owns only the editor gate.
- Usage analytics (I-2) and cross-device sync (I-4).
- AI-assisted skill generation or content authoring — Craft is a structured editor, not an agent.

## Constraints

- Tauri v2 (Rust core) + React/TypeScript/Vite; no Python.
- The publish/install gate MUST use the same agentskills.io / `skills-ref` validation rules as the shop install path (I-1) — one validation source of truth, mirrored, not forked.
- The filesystem is the single source of truth; Craft edits skill directories directly.

## Change Log
- **2026-05-29** — Initial draft. Outcome relocated from I-1 during the 4-way split of the original product-level intent.
