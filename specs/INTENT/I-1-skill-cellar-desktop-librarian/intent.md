---
id: I-1
title: Shop, install & conformance
slug: skill-cellar-desktop-librarian
status: complete
opened: 2026-05-29
closed: 2026-05-30
superseded_by: null
verdict_outcomes_passed: 3
verdict_outcomes_passed_by_agent: 0
verdict_outcomes_passed_by_test: 3
verdict_outcomes_total: 3
verdict_checked_at: 2026-05-30T02:20:28Z
---

# Intent: Shop, install & conformance

- **Author:** Jason Lo
- **Last updated:** 2026-05-29

## Problem

Acquiring an AI-agent skill today is CLI- and filesystem-only: installing means hand-editing `.claude/skills/` directories, with no visual surface to browse installable skills, no atomic safety if a copy half-fails, and no way to see whether a skill conforms to the agentskills.io spec before or after install. There is no shop, and trust signals (is this skill well-formed?) are invisible.

## Outcome

- **WHEN** a user installs a skill from the shop **THE SYSTEM SHALL** validate it against the agentskills.io spec and copy it into the active target's `.claude/skills/<name>/` atomically, leaving no partial directory if validation or copy fails. [test: cargo:install_atomic_validates_then_copies]
- **WHEN** a skill is shown in the shop or library **THE SYSTEM SHALL** display a conformance verdict of valid, warnings, or invalid derived from its `SKILL.md` frontmatter rules. [test: cargo:conformance_verdict_from_frontmatter]
- **IF** the GitHub API is unreachable **THEN THE SYSTEM SHALL** fall back to the cached registry so the Featured shop stays usable. [test: cargo:registry_falls_back_to_cache_when_offline]

## Non-Goals

- Usage analytics — moved to **I-2 (Usage analytics)**.
- The Craft authoring editor and its publish/install gate — moved to **I-3 (Craft skill editor)**.
- Cross-device sync and its privacy boundary — moved to **I-4 (Privacy & sync boundary)**.
- Running agent workflows (diagnose, autoresearch, etc.) — those remain in Claude Code; skill-cellar manages skill *files*, it does not launch an agent.
- Plugin-marketplace (`/plugin`) installs.
- Publishing skills to a shared registry.
- Non-Claude / other-agent skill formats.

## Constraints

- Tauri v2 shell (Rust core, native webview) + React + TypeScript + Vite frontend; no Python.
- The filesystem (skill directories) is the single source of truth — no hidden database of installed state.
- Conformance mirrors the official `skills-ref` rules (`name` ≤64 chars and matches the parent dir; `description` 1–1024 chars).
- The app is fully functional offline; the registry cache backs the shop when GitHub is unreachable.

## Change Log
- **2026-05-29** — Initial draft.
- **2026-05-29** — Replaced the telemetry/network non-goal with an opt-in, metadata-only sync boundary and added outcomes for the sync guarantee, to align with constitution P-4/P-7/P-8.
- **2026-05-29** — Narrowed scope to Shop/Install/Conformance (outcomes for atomic install, conformance verdict, registry offline fallback). Relocated usage analytics → I-2, Craft editor → I-3, and the sync privacy boundary → I-4, so each feature area can reach `complete` independently rather than blocking on the whole product. Retitled from "skill-cellar desktop librarian"; slug retained (immutable). verdict_* left for ls-check to recompute.
