# Work Contracts

This directory holds bounded work contracts and evidence summaries for complex tasks that are already in the `Work` checkpoint.

## Purpose

Execution plans explain the larger path. Work contracts define the next bounded slice inside that path.

Use a work contract when a task is complex enough that the next implementation step needs explicit scope, exclusions, proof requirements, and recovery guidance before coding begins.

## Relationship To Other Artifacts

- `docs/execution/plans/` describes the broader multi-step plan.
- `docs/execution/progress/` tracks current milestone and checkpoint progress.
- `docs/execution/contracts/` defines the active bounded slice inside `Work` and the evidence summaries attached to that slice.
- `docs/artifacts/reviews/` and `docs/artifacts/reviews/findings/` capture later review outcomes and durable findings.

## Runtime State

- Active contract lifecycle state is stored beside the harness thread state in `.agentx/state/harness-state.json`.
- Loop completion remains in `.agentx/state/loop-state.json`.
- Contracts do not replace harness threads or loop state; they attach bounded slice state to the active thread and turn so workflow guidance can explain the current slice, blocker, and next action.
- Slice findings are attached to the active contract and should capture severity plus the next action required before final review.

## Minimum Sections

A valid work contract should include:

- Purpose
- Scope
- Not In Scope
- Acceptance Criteria
- Verification Method
- Runtime Evidence Expectations
- Risks
- Recovery Path

An evidence summary linked from the contract should distinguish:

- implementation evidence
- verification evidence
- runtime evidence

## Naming Guidance

- Prefer `CONTRACT-<issue>-<topic>.md`.
- Prefer `EVIDENCE-<issue>-<topic>.md` for the matching evidence summary.
- Keep the topic stem stable if the contract evolves across iterations.
- Superseded contracts should remain durable but clearly marked in the `Status` field.

## Workflow Rule

Work contracts do not create a second lifecycle. They are bounded artifacts nested inside the existing `Work` checkpoint.