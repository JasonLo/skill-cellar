---
id: I-3
title: Craft skill editor
slug: craft-skill-editor
status: complete
opened: 2026-05-29
closed: 2026-05-30
superseded_by: null
verdict_outcomes_passed: 1
verdict_outcomes_passed_by_agent: 0
verdict_outcomes_passed_by_test: 1
verdict_outcomes_total: 1
verdict_checked_at: 2026-05-30T04:02:49Z
---

# Intent: Craft skill editor

- **Author:** Jason Lo
- **Last updated:** 2026-05-30

## Problem

Authoring or editing a skill today means hand-editing `SKILL.md` and discovering spec violations only at install time — or never. There is no editing surface that validates frontmatter as you go and stops you from shipping a malformed skill, so invalid skills can be installed or "published" locally and fail silently later.

## Outcome

- **WHILE** editing a skill in Craft **THE SYSTEM SHALL** block publish or install of a skill whose frontmatter fails spec validation and display the failing rule inline. [test: vitest:src/core/fs-skills/publish.test.ts -t "blocks publish on invalid frontmatter"]

## Non-Goals

- Publishing skills to a shared/remote registry — Craft writes locally only.
- The shop, install pipeline, and conformance-verdict display surface (I-1) — Craft reuses the same validation rules but owns only the editor gate.
- Usage analytics (I-2) and cross-device sync (I-4).
- AI-assisted skill generation or content authoring — Craft is a structured editor, not an agent.

## Constraints

- OpenTUI on the Bun runtime + React + TypeScript via OpenTUI's React reconciler; no Vite, Rust, or Python.
- The publish/install gate MUST use the same agentskills.io / `skills-ref` validation rules as the shop install path (I-1) — one validation source of truth, mirrored, not forked.
- The filesystem is the single source of truth; Craft edits skill directories directly.

## Change Log
- **2026-05-29** — Initial draft. Outcome relocated from I-1 during the 4-way split of the original product-level intent.
- **2026-05-30** — Updated Constraints to reflect substrate change (Tauri/Rust/Vite → OpenTUI/Bun/TypeScript) per CONSTITUTION amendment of 2026-05-30. Product outcome (Craft blocks publish/install on invalid frontmatter) unchanged. The vitest citation `src/screens/Craft.test.tsx` may need rework as the UI shape shifts from DOM React to OpenTUI components (no `screens` metaphor in a TUI; likely a different file path post-migration) — /spec-check will flag the drift when the file moves.
- **2026-05-30** — Migrated the test citation from the DOM-React `src/screens/Craft.test.tsx` to the core-level `src/core/fs-skills/publish.test.ts`. The publish gate now lives in `publishSkill()` (same code path the eventual OpenTUI surface will call), and the test verifies (a) publish throws `ValidationFailedError` on invalid frontmatter, (b) the failing rule is surfaced on the error's `conformance.findings[]` so the UI can display it inline, and (c) no FS side effects on rejection. The DOM-React Craft screen is being retired alongside Vite/Tauri; once the OpenTUI surface lands, this citation can be augmented with an OpenTUI-level inline-display check via an agent prompt if the SHALL's display clause needs UI-level verification.
