# Execution Artifacts

This directory holds the living artifacts for complex work that is still being executed, reviewed, or validated.

## Folders

- `plans/` contains the execution plan for a complex task.
- `progress/` contains the matching progress log for that task.
- `contracts/` contains bounded work contracts and their matching evidence summaries used inside the `Work` checkpoint for complex tasks.

## Naming Guidance

- Prefer `TOPIC-PLAN.md` for plans.
- Prefer `TOPIC-PROGRESS.md` for progress logs.
- Prefer `CONTRACT-<issue>-<topic>.md` for bounded work contracts.
- Prefer `EVIDENCE-<issue>-<topic>.md` for the matching evidence summary.
- Keep the topic stem stable so search results and pairings remain obvious.

## Relationship To Other Docs

- Durable design artifacts still live in `docs/artifacts/prd/`, `docs/artifacts/adr/`, `docs/artifacts/specs/`, `docs/artifacts/reviews/`, and `docs/artifacts/learnings/`.
- Execution artifacts are living state, not the final long-term source of product or architecture truth.
- Work contracts are nested execution artifacts: they bound the active slice inside `Work`, but they do not create a second workflow lifecycle.
- Evidence summaries are the matching proof layer for those contracts, distinguishing what changed, what was checked, and what was observed on the real surface.