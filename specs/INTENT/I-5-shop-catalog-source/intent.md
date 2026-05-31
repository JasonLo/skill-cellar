---
id: I-5
title: Shop catalog source
slug: shop-catalog-source
status: complete
opened: 2026-05-29
closed: 2026-05-30
superseded_by: null
verdict_outcomes_passed: 3
verdict_outcomes_passed_by_agent: 0
verdict_outcomes_passed_by_test: 3
verdict_outcomes_total: 3
verdict_checked_at: 2026-05-30T22:20:00Z
---

# Intent: Shop catalog source

- **Author:** Jason Lo
- **Last updated:** 2026-05-30

## Problem

The Shop has no live source of truth for *which skills exist to install*. D-3 deferred the live fetch and ships only a local-dir `SkillSource`, so the Featured catalog is effectively hardcoded — it cannot be curated or updated without an app release. The catalog must live somewhere hosted, editable without a release, and cacheable for offline use, without being placed in Turso (P-4/P-7/P-8 forbid load-bearing or non-usage-metadata data in the opt-in/off-by-default sync store).

## Outcome

- **WHEN** the Shop is opened **THE SYSTEM SHALL** load the catalog from the configured GitHub gist and persist the fetched copy to the local registry cache for offline reuse. [test: vitest:src/core/registry/registry.test.ts -t "catalog_loads_from_gist_and_caches"]
- **WHEN** a fetched catalog entry fails catalog-schema validation **THE SYSTEM SHALL** skip only that entry and surface the remaining valid entries, never failing the whole Shop on a single malformed entry. [test: vitest:src/core/registry/registry.test.ts -t "catalog_skips_invalid_entries"]
- **WHEN** the cached catalog is older than a staleness threshold (TBD — e.g. 24h) and the network is reachable **THE SYSTEM SHALL** refresh it from the gist; otherwise it SHALL serve the cached copy. [test: vitest:src/core/registry/registry.test.ts -t "catalog_refreshes_when_stale"]

## Non-Goals

- Live crawling of GitHub repos / topic search to auto-discover skills — the gist is a hand-curated list.
- Write-back: the app never edits the gist; curation happens out-of-band in the gist itself.
- Hosting skill *contents* in the gist — entries are metadata + source pointers only; install fetch is governed by the `SkillSource` trait (D-3), not this intent.
- Putting the catalog in Turso, or any dependence on sync being enabled (P-4/P-5/P-7/P-8).
- Private/authenticated gists, OAuth, or per-user catalogs — the gist is public, read-only.
- Multi-source merging (several gists / mirrors) — single configured source for now.
- The offline-fallback-on-API-failure guarantee already owned by I-1 (`registry_falls_back_to_cache_when_offline`).

## Constraints

- TypeScript backend on the Bun runtime, no Rust or Python (P-2); fetch via the existing `SkillSource` abstraction (D-3).
- The catalog is NOT usage metadata and MUST NOT be stored in or depend on Turso; it MUST work with sync disabled (P-4, P-7) and must never live in the sync store (P-5, P-8).
- Local-first: a cached catalog MUST back the Shop whenever the gist is unreachable, consistent with I-1's offline fallback.
- Gist access is read-only and unauthenticated (public gist); no secrets in the app.
- Catalog entries are metadata/pointers; the filesystem remains the source of truth for installed state (P-5).

## Change Log
- **2026-05-29** — Initial draft.
- **2026-05-30** — Updated Constraints to reflect substrate change (Rust core → TypeScript on Bun) per CONSTITUTION amendment of 2026-05-30. The earlier 4-intent refine sweep missed I-5; spec-check surfaced the obsolete P-2 reference. Product outcomes (gist load + cache, schema-invalid skip, staleness refresh) unchanged. Existing `cargo:` test citations will migrate to bun-test/vitest equivalents as the substrate replacement lands.
- **2026-05-30** — Migrated the three test citations from `cargo:` to `vitest:` against the ported TypeScript registry module at `src/core/registry/`. The cited tests (gist load + cache, malformed-entry skip, staleness-gated refresh) all green; the staleness threshold remains a 24h default exposed as `DEFAULT_STALENESS_SECONDS`.
