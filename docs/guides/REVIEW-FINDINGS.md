# Review Findings Guidance

## Purpose

This guide defines how AgentX should persist durable review findings and when those
findings should be promoted into normal tracked backlog work.

## Durable Record

Store durable review findings under `docs/reviews/findings/FINDING-<issue>-<id>.md`.

Each durable finding record should capture:

- source review artifact
- source issue when known
- severity
- workflow status using the standard AgentX status set
- priority using `p0` through `p3`
- owner or suggested owner
- dependencies
- evidence links
- promotion classification
- linked backlog issue once promoted

## Status Contract

Durable findings reuse the normal AgentX workflow states so review follow-up does not
create a second state machine.

| Status | Meaning |
|--------|---------|
| Backlog | Finding is captured and awaiting triage or promotion |
| Ready | Finding has been accepted as follow-up work and is ready to be picked up |
| In Progress | Follow-up implementation is underway |
| In Review | Follow-up change is under review |
| Done | Follow-up is resolved or explicitly closed |

## Promotion Contract

Each finding must declare one of these promotion modes:

- `review-only`: preserve the finding in the review record, but do not create a backlog item
- `recommended`: finding is important enough that maintainers should normally promote it
- `required`: finding should become tracked backlog work unless it is immediately resolved in
  the current review cycle

## Promote Versus Keep Review-Only

Promote the finding when one or more of these conditions are true:

- the finding affects correctness, security, resilience, or workflow safety
- the finding requires code or documentation work beyond the current review cycle
- the finding should be prioritized, assigned, or tracked across sessions
- the finding blocks parity, review quality, or repeatable operator behavior

Keep the finding review-only when one or more of these conditions are true:

- the note is informational and needs no tracked follow-up
- the issue is already fully covered by an existing backlog item
- the concern is too weakly evidenced to justify tracked work
- the fix is completed before the review closes

## Lifecycle Rules

1. Capture the durable finding record during review or immediately after review.
2. Use `Backlog` as the initial status for captured findings.
3. Promote only into the existing AgentX issue flow. Do not create a parallel tracker.
4. When promoted, link the created backlog issue number back into the finding record.
5. Let the promoted issue follow the normal AgentX workflow from `Backlog` to `Done`.
6. Keep dependencies and evidence links in the finding record even after promotion.

## Priority And Dependencies

- Map urgency into `p0` through `p3` and carry that priority into the promoted issue labels.
- Preserve dependencies as issue references, plan references, or artifact links so triage can
  sequence the work correctly.
- Use the finding record as the durable evidence index and the backlog issue as the workflow
  execution record.

## Notes

- Local mode and GitHub mode should use the same finding format and lifecycle rules.
- Promotion should create a normal AgentX issue instead of a custom review-only work item type.
- If a promoted issue already exists, link it in the finding record instead of creating a duplicate.