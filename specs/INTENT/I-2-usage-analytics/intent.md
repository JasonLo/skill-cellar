---
id: I-2
title: Usage analytics
slug: usage-analytics
status: complete
opened: 2026-05-29
closed: 2026-05-30
superseded_by: null
verdict_outcomes_passed: 1
verdict_outcomes_passed_by_agent: 0
verdict_outcomes_passed_by_test: 1
verdict_outcomes_total: 1
verdict_checked_at: 2026-05-30T02:53:44Z
---

# Intent: Usage analytics

- **Author:** Jason Lo
- **Last updated:** 2026-05-30

## Problem

Knowing which installed skills actually get used means reading Claude Code transcripts by hand. There is no surface that tells a user, per project, how often each skill was invoked — so pruning unused skills or recognizing heavily-relied-on ones is guesswork.

## Outcome

- **WHEN** the Usage screen is opened **THE SYSTEM SHALL** report per-skill invocation counts parsed from local Claude Code JSONL transcripts, grouped by project. [test: vitest:src/core/usage/usage.test.ts -t "usage_counts_skill_invocations_by_project"]

## Non-Goals

- Adding new instrumentation or telemetry hooks — analytics are read-only over transcripts that already exist.
- Transmitting any usage data off the device — the privacy/sync boundary is owned by I-4.
- Conformance, install, or shop concerns (I-1) and the Craft editor (I-3).
- Time-series dashboards, charts, or trend analysis beyond per-skill, per-project counts.

## Constraints

- OpenTUI on the Bun runtime + React + TypeScript via OpenTUI's React reconciler; no Vite, Rust, or Python.
- Usage analytics are read-only over existing JSONL transcripts; no new instrumentation.
- The filesystem is the single source of truth; counts are derived on read, not persisted as authoritative state.
- Fully functional offline — transcript parsing is local-only.

## Change Log
- **2026-05-29** — Initial draft. Outcome relocated from I-1 during the 4-way split of the original product-level intent.
- **2026-05-30** — Updated Constraints to reflect substrate change (Tauri/Rust/Vite → OpenTUI/Bun/TypeScript) per CONSTITUTION amendment of 2026-05-30. Product outcome (per-skill invocation counts from local JSONL transcripts) unchanged. The `cargo:` test citation will migrate to a bun-test/vitest equivalent as the substrate replacement lands.
- **2026-05-30** — Migrated the test citation from `cargo:` to `vitest:` against the ported TypeScript usage parser at `src/core/usage/`. Tolerant JSONL parsing and the by-project grouping behavior preserved verbatim.
