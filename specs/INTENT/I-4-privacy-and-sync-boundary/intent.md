---
id: I-4
title: Privacy & sync boundary
slug: privacy-and-sync-boundary
status: draft
opened: 2026-05-29
closed: null
superseded_by: null
verdict_outcomes_passed: 0
verdict_outcomes_passed_by_agent: 0
verdict_outcomes_passed_by_test: 0
verdict_outcomes_total: 2
verdict_checked_at: 2026-05-29T20:25:00Z
---

# Intent: Privacy & sync boundary

- **Author:** Jason Lo
- **Last updated:** 2026-05-29

## Problem

Optional cross-device sync introduces the one path by which data can leave the device. Without an enforced boundary, sync risks being on by default or carrying sensitive content (transcripts, prompts, file contents, paths). The constitution (P-7, P-8) requires opt-in, metadata-only egress, and that guarantee needs concrete, testable outcomes rather than a prose promise.

## Outcome

- **IF** the user has not enabled cross-device sync **THEN THE SYSTEM SHALL** transmit no data off the device. [test: cargo:no_transmission_until_sync_enabled]
- **WHEN** cross-device sync is enabled **THE SYSTEM SHALL** include only usage metadata (skill names, invocation counts, timestamps, app and skill versions) in the sync payload, excluding transcript content, prompts, file contents, and file paths. [test: cargo:sync_payload_metadata_only]

## Non-Goals

- Sync transport/provider choice beyond the constitution's mandate (Turso/libSQL) — this intent governs the *boundary*, not the schema design.
- Syncing authoritative installed-skill state — the filesystem remains the source of truth (P-5); only derived usage metadata may sync.
- The usage-counting logic itself (I-2); this intent governs only what crosses the device boundary.
- Account systems, auth, or multi-user sharing.

## Constraints

- Tauri v2 (Rust core) + React/TypeScript/Vite; no Python.
- MUST satisfy constitution P-7 (egress opt-in, off by default) and P-8 (metadata-only; never transcript content, prompts, file contents, or file paths).
- Cross-device sync, when enabled, uses Turso (libSQL) and is local-first — the app is fully functional offline with sync disabled (P-4).
- The sync store holds only derived usage metadata, never authoritative installed state (P-5).

## Change Log
- **2026-05-29** — Initial draft. Outcomes relocated from I-1 during the 4-way split of the original product-level intent.
