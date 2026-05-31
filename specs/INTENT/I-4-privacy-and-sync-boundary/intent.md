---
id: I-4
title: Privacy & sync boundary
slug: privacy-and-sync-boundary
status: complete
opened: 2026-05-29
closed: 2026-05-30
superseded_by: null
verdict_outcomes_passed: 2
verdict_outcomes_passed_by_agent: 0
verdict_outcomes_passed_by_test: 2
verdict_outcomes_total: 2
verdict_checked_at: 2026-05-30T22:20:00Z
---

# Intent: Privacy & sync boundary

- **Author:** Jason Lo
- **Last updated:** 2026-05-30

## Problem

Optional cross-device sync introduces the one path by which data can leave the device. Without an enforced boundary, sync risks being on by default or carrying sensitive content (transcripts, prompts, file contents, paths). The constitution (P-7, P-8) requires opt-in, metadata-only egress, and that guarantee needs concrete, testable outcomes rather than a prose promise.

## Outcome

- **IF** the user has not enabled cross-device sync **THEN THE SYSTEM SHALL** transmit no data off the device. [test: vitest:src/core/sync/sync.test.ts -t "no_transmission_until_sync_enabled"]
- **WHEN** cross-device sync is enabled **THE SYSTEM SHALL** include only usage metadata (skill names, invocation counts, timestamps, app and skill versions) in the sync payload, excluding transcript content, prompts, file contents, and file paths. [test: vitest:src/core/sync/sync.test.ts -t "sync_payload_metadata_only"]

## Non-Goals

- Sync transport/provider choice beyond the constitution's mandate (Turso/libSQL) — this intent governs the *boundary*, not the schema design.
- Syncing authoritative installed-skill state — the filesystem remains the source of truth (P-5); only derived usage metadata may sync.
- The usage-counting logic itself (I-2); this intent governs only what crosses the device boundary.
- Account systems, auth, or multi-user sharing.

## Constraints

- OpenTUI on the Bun runtime + React + TypeScript via OpenTUI's React reconciler; no Vite, Rust, or Python.
- MUST satisfy constitution P-7 (egress opt-in, off by default) and P-8 (metadata-only; never transcript content, prompts, file contents, or file paths).
- Cross-device sync, when enabled, uses Turso (libSQL) and is local-first — the app is fully functional offline with sync disabled (P-4).
- The sync store holds only derived usage metadata, never authoritative installed state (P-5).

## Change Log
- **2026-05-29** — Initial draft. Outcomes relocated from I-1 during the 4-way split of the original product-level intent.
- **2026-05-30** — Updated Constraints to reflect substrate change (Tauri/Rust/Vite → OpenTUI/Bun/TypeScript) per CONSTITUTION amendment of 2026-05-30. Product outcomes (opt-in sync, metadata-only payload) unchanged. The `cargo:` test citations will migrate to bun-test/vitest equivalents as the substrate replacement lands.
- **2026-05-30** — Implemented the sync boundary as a TypeScript module at `src/core/sync/` (off-by-default `SyncBoundary` + injectable `SyncTransport`, plus a `buildSyncPayload` projection that collapses per-project paths and keeps only skill name + count + version + timestamps). Migrated both test citations from `cargo:` to `vitest:` against the new module. Reason: the prior Rust placeholders had no implementation; this lands a concrete boundary the EARS outcomes can grade.
