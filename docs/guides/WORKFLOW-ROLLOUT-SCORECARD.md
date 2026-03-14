# Workflow Rollout Scorecard

This scorecard is the phase-one rollout controller for epic #215. It stays deterministic, artifact-backed, and advisory-first.

## Review Cadence

- Review the scorecard before promoting the next pilot slice.
- Use repo artifacts, not narrative-only judgment, for every row decision.
- If a row is warning or blocked, contain the rollout and repair the shared contract first.

## Scorecard Rows

| Order | Slice | Owner | Success Signals | Warning Signals | Recovery Path |
| --- | --- | --- | --- | --- | --- |
| 1 | Workflow cohesion | engineer | Shared checkpoint language, shared next-step payload, rollout support docs present | Guidance drifts by surface, entry points lose context | Revert to the prior stable workflow surfaces and repair the shared contract |
| 2 | Task bundles | architect | Workflow cohesion remains pilot-ready through review | Bundle logic starts before cohesion is stable | Keep task-bundle work blocked until workflow cohesion is stable again |
| 3 | Bounded parallel delivery | engineer | Bundle rules and workflow guidance remain aligned | Parallel work causes state drift or reconciliation gaps | Return to single-path execution until the control plane is stable |
| 4 | Skill packaging | engineer | Packaged guidance matches the shared contract | Packaged outputs drift from the checkpoint vocabulary | Keep packaging repo-local until the workflow contract is stable |
| 5 | Portability generation | engineer | Earlier slices remain stable long enough to trust generated outputs | Host-specific drift appears before the control plane settles | Pause portability work and re-anchor to the repo-native workflow artifacts |

## Decision States

- `pilot-ready`: the slice has the required control artifacts and can enter pilot review.
- `active`: the slice is the current focus and still assembling required evidence.
- `queued`: the slice is next in order once the prior slice remains stable.
- `blocked`: the slice must not start because a prior dependency is not yet stable.

## Evidence Expectations

- Workflow cohesion references the checkpoint contract, next-step recommendations, plan-deepening entry points, review-kickoff entry points, pilot order, and operator checklist.
- Later slices must point back to this scorecard when they seek promotion.
- Every promotion decision must name the specific evidence that justified it.