# Evidence Model

This document defines the three evidence classes used by bounded work contracts and related review surfaces.

## Evidence Classes

| Evidence Class | What It Proves | Typical Sources | Durable Home |
|----------------|----------------|-----------------|--------------|
| Implementation evidence | What changed | file diffs, generated artifacts, scoped outputs | contract-linked summary or plan/progress note |
| Verification evidence | What was checked mechanically | tests, builds, lint, typecheck, static validation | contract-linked summary or progress note |
| Runtime evidence | What was observed on the real surface | UI walkthroughs, API responses, logs, traces, screenshots, evaluator observations | contract-linked summary, review artifact, or finding record |

## Why These Classes Exist

- Implementation evidence answers: `What changed?`
- Verification evidence answers: `What checks passed or failed?`
- Runtime evidence answers: `What was actually observed on the real surface?`

Complex work should use all three when the slice affects real behavior. Simpler changes may only need implementation and verification evidence.

## Durable Locations

| Artifact | Purpose |
|----------|---------|
| `docs/execution/contracts/CONTRACT-<issue>-<topic>.md` | Defines the active bounded slice and expected evidence |
| `docs/execution/contracts/EVIDENCE-<issue>-<topic>.md` | Summarizes implementation, verification, and runtime proof for the slice |
| `docs/execution/progress/` | Tracks milestone-level progress and can link to evidence summaries |
| `docs/artifacts/reviews/REVIEW-*.md` | Captures final review decisions and cites relevant evidence |
| `docs/artifacts/reviews/findings/` | Stores durable findings that survive beyond the current review cycle |

## Surface Expectations

### Bounded Work Contracts

Contracts should declare:

- what implementation evidence is expected
- what verification evidence is required before advancing
- what runtime evidence is required for the slice

### Evaluator Surfaces

Evaluator outputs should refer back to the active evidence summary rather than inventing a separate proof vocabulary.

### Review Surfaces

Review artifacts should cite the relevant evidence summary and any durable findings when explaining approval, rejection, or follow-up work.

## Minimum Rule

If a complex slice claims completion, the repo should make it easy to answer all three questions:

1. What changed?
2. What checks passed?
3. What was observed on the real surface?