---
id: I-2
title: Usage analytics
slug: usage-analytics
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

# Intent: Usage analytics

- **Author:** Jason Lo
- **Last updated:** 2026-05-29

## Problem

Knowing which installed skills actually get used means reading Claude Code transcripts by hand. There is no surface that tells a user, per project, how often each skill was invoked — so pruning unused skills or recognizing heavily-relied-on ones is guesswork.

## Outcome

- **WHEN** the Usage screen is opened **THE SYSTEM SHALL** report per-skill invocation counts parsed from local Claude Code JSONL transcripts, grouped by project. [test: cargo:usage_counts_skill_invocations_by_project]

## Non-Goals

- Adding new instrumentation or telemetry hooks — analytics are read-only over transcripts that already exist.
- Transmitting any usage data off the device — the privacy/sync boundary is owned by I-4.
- Conformance, install, or shop concerns (I-1) and the Craft editor (I-3).
- Time-series dashboards, charts, or trend analysis beyond per-skill, per-project counts.

## Constraints

- Tauri v2 (Rust core) + React/TypeScript/Vite; no Python.
- Usage analytics are read-only over existing JSONL transcripts; no new instrumentation.
- The filesystem is the single source of truth; counts are derived on read, not persisted as authoritative state.
- Fully functional offline — transcript parsing is local-only.

## Change Log
- **2026-05-29** — Initial draft. Outcome relocated from I-1 during the 4-way split of the original product-level intent.
