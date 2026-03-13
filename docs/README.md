# Docs Structure

This directory now has a canonical split between reference guidance, durable workflow artifacts, and living execution state.

## Canonical Locations

- Core reference docs stay at the top of `docs/` when they are repo-wide guidance, for example `WORKFLOW.md`, `GUIDE.md`, `GOLDEN_PRINCIPLES.md`, `QUALITY_SCORE.md`, and `tech-debt-tracker.md`.
- Durable workflow artifacts remain in their established families:
  - `docs/artifacts/prd/`
  - `docs/artifacts/adr/`
  - `docs/artifacts/specs/`
  - `docs/artifacts/reviews/`
  - `docs/artifacts/learnings/`
- Living execution artifacts now use:
  - `docs/execution/plans/`
  - `docs/execution/progress/`

## Migration Rules

- `docs/plans/` and `docs/progress/` are redirect-only shims during migration.
- `docs/prd/`, `docs/adr/`, `docs/specs/`, `docs/reviews/`, and `docs/learnings/` are redirect-only shims to the canonical `docs/artifacts/` tree.
- New complex-work plans must be created under `docs/execution/plans/`.
- New progress logs must be created under `docs/execution/progress/`.
- New durable artifact files must be created under `docs/artifacts/`.

## Why This Split Exists

The old top-level artifact families mixed stable deliverables with live execution state and made path ownership harder to reason about. The `docs/execution/` tree now isolates living implementation state, while `docs/artifacts/` collects durable PRDs, ADRs, specs, reviews, and learnings under one canonical root.