# Knowledge Capture Guidance

## Purpose

This guide defines when a completed AgentX work item should produce a durable learning artifact and where that artifact should live.

## Trigger Model

- Mandatory capture:
  Work produces reusable workflow, architecture, review, validation, or operator guidance that is likely to help future planning or review.
- Optional capture:
  Work is useful but narrow, local, or low-leverage, so a capture artifact is helpful but not required.
- Skip capture:
  Work is trivial, transient, duplicated by an existing learning, or too weakly validated to preserve as durable guidance.

## Operator-Facing Path

1. Finish review and validate the final outcome.
2. Resolve the capture decision as mandatory, optional, or skip.
3. When capture is produced, store it under `docs/learnings/LEARNING-<issue>.md`.
4. Link the learning back to the originating issue and its supporting ADR, spec, review, plan, progress, or validation artifacts.
5. If capture is skipped, record a short rationale in the close-out summary or issue comment.

## Autonomous Execution Path

1. AgentX finishes the same review and validation steps it would require from an operator.
2. AgentX resolves the capture decision after review, not during initial implementation.
3. When capture is required or accepted, AgentX creates the learning artifact and mentions it in the final summary.
4. The flow stays advisory-first until stronger automation and duplication checks are proven.

## Artifact Location

- Curated durable learnings: `docs/learnings/LEARNING-<issue>.md`
- Source documents remain in their original families, such as `docs/adr/`, `docs/specs/`, `docs/reviews/`, `docs/plans/`, and issue state.

## Minimum Link-Back Requirements

Each curated learning should link back to:

- the originating issue
- the main supporting design or execution artifacts
- the review or validation artifact that makes the learning trustworthy

## Notes

- Do not create a second backlog or sidecar tracker for learnings.
- Do not treat raw runtime observations as curated learnings by default.
- Prefer a small number of high-signal learning artifacts over a large volume of weak notes.
