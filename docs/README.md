# Docs Structure

This directory has a canonical split between reference guidance, durable workflow artifacts, and living execution state.

## Canonical Locations

- Core reference docs stay at the top of docs/ when they are repo-wide guidance:
  - WORKFLOW.md
  - GUIDE.md
  - GOLDEN_PRINCIPLES.md
  - QUALITY_SCORE.md
  - 	ech-debt-tracker.md
- Durable workflow artifacts remain in their established families:
  - docs/artifacts/prd/
  - docs/artifacts/adr/
  - docs/artifacts/specs/
  - docs/artifacts/reviews/
  - docs/artifacts/learnings/
- Living execution artifacts use:
  - docs/execution/plans/
  - docs/execution/progress/

## Why This Split Exists

The docs/execution/ tree isolates living implementation state during issue execution, while docs/artifacts/ collects durable PRDs, ADRs, specs, reviews, and learnings under one canonical root. 
