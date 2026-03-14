---
title: Workflow Checkpoint Contract Implementation
status: Complete
owner: Product Manager
last_updated: 2026-03-13
---

# Execution Plan: Workflow Checkpoint Contract Implementation

**Issue**: #220
**Epic**: #215
**Feature**: #214

## Purpose / Big Picture

Define the canonical phase-one workflow checkpoints for brainstorm, plan, work, review, and compound capture so AgentX surfaces speak the same operating language. This story should produce a durable checkpoint contract that names each stage, explains required evidence, and clarifies entry, exit, and closeout expectations without introducing a second state machine.

## Progress

- [x] Story intent grounded in PRD-215, ADR-215, and SPEC-215
- [x] Dependency on rollout controls and related phase-one stories identified
- [x] Initial implementation plan drafted
- [x] Canonical checkpoint table agreed
- [x] Entry and exit evidence model agreed
- [x] Surface-language reuse expectations agreed
- [x] Story-ready documentation checklist approved

## Surprises & Discoveries

- Observation: The approved architecture already defines the checkpoint resolver, entry-point contract, and recommendation engine as separate phase-one components.
  Evidence: `docs/artifacts/specs/SPEC-215.md` sections 3.2 and 4.1.
- Observation: The highest risk for this story is terminology drift across docs and backlog artifacts rather than lack of lifecycle ideas.
  Evidence: Phase-one issue numbering drift required a backlog correction before implementation planning could continue cleanly.
- Observation: This story must stay docs-first so later surface work can reuse one contract instead of improvising per surface.
  Evidence: PRD-215 acceptance criteria and feature `#214` scope both require shared naming across docs, commands, chat, and sidebar surfaces.

## Decision Log

- Decision: Reuse the current AgentX workflow states instead of inventing a second runtime lifecycle.
  Options Considered: New workflow state machine; checkpoint naming layered over current states; surface-specific lifecycle labels.
  Chosen: Checkpoint naming layered over current states.
  Rationale: The initiative is additive and deterministic. Operators need clearer language, not a competing state model.
  Date/Author: 2026-03-13 / GitHub Copilot
- Decision: Treat checkpoint evidence and closeout expectations as part of the contract, not follow-up guidance.
  Options Considered: Names only; names plus entry criteria; names plus entry, exit, and artifact expectations.
  Chosen: Names plus entry, exit, and artifact expectations.
  Rationale: Later entry points and recommendations need durable evidence rules to remain deterministic.
  Date/Author: 2026-03-13 / GitHub Copilot

## Context and Orientation

Key files and artifacts:

- `docs/artifacts/prd/PRD-215.md`
- `docs/artifacts/adr/ADR-215.md`
- `docs/artifacts/specs/SPEC-215.md`
- `docs/WORKFLOW.md`
- `docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md`
- `docs/execution/plans/COMPOUND-WORKFLOW-AND-PORTABILITY-PLAN.md`
- `docs/execution/progress/COMPOUND-WORKFLOW-AND-PORTABILITY-PROGRESS.md`

Constraints:

- The contract must remain repo-native and additive.
- The contract must be evidence-backed and fail closed when prerequisites are missing.
- The contract must support chat, command palette, sidebar, CLI, and docs without surface-specific wording drift.
- Rollout controls from story `#219` should be in place before this story broadens into implementation work.

## Plan of Work

Define a compact checkpoint contract that lists each stage, its purpose, prerequisites, evidence, exit signal, and expected next transition. Then align that contract with the existing workflow guidance and phase-one backlog so later entry-point and recommendation stories can consume one source of truth. Finish by identifying which surfaces must mirror the checkpoint names verbatim during implementation.

## Steps

| Step | Action | Owner | Status | Notes |
|------|--------|-------|--------|-------|
| 1 | Confirm the canonical checkpoint set and the role of each stage | Product Manager | Complete | Brainstorm, plan, work, review, compound capture, done |
| 2 | Define entry criteria, exit criteria, and artifact expectations for each checkpoint | Product Manager | Complete | Reuse existing artifact families |
| 3 | Define dependency and closeout expectations tied to each checkpoint | Product Manager | Complete | Keep deterministic and inspectable |
| 4 | Update durable workflow guidance to reference the checkpoint contract | Product Manager | Complete | Docs-first contract slice |
| 5 | Link downstream stories `#221` and `#218` to the finalized checkpoint contract | Product Manager | Complete | Prevent follow-on drift |

## Concrete Steps

- Draft a checkpoint table with checkpoint, operator intent, prerequisites, evidence, exit signal, and next transition.
- Cross-check the table against PRD-215 and SPEC-215 component boundaries.
- Update the initiative progress log and related story references once the checkpoint contract is stable.
- Require later feature work to reference the checkpoint names exactly.

## Dependencies

- Story `#219` rollout controls remain the gating rollout artifact.
- Feature `#214` remains the parent feature.
- Stories `#221` and `#218` should consume this contract after it is approved.

## Validation and Acceptance

- [x] Each checkpoint has documented entry criteria, exit criteria, and artifact expectations
- [x] Shared naming can be reused verbatim across docs, commands, chat, sidebar, and CLI surfaces
- [x] The contract reuses current AgentX workflow states instead of introducing a second state machine
- [x] Dependencies, required artifacts, and closeout expectations are documented for each checkpoint
- [x] The contract is explicit enough to guide stories `#221` and `#218`

## Idempotence and Recovery

This story is safe to iterate because the checkpoint contract is a documentation and workflow-alignment artifact. If a checkpoint definition proves too broad, it can be refined without destabilizing the live backlog as long as dependent story links and rollout sequencing are kept current.

## Rollback Plan

If the contract becomes too detailed to use, reduce it to the minimum set of checkpoint definitions and artifact rules required by the feature acceptance criteria, then add optional notes in later guidance instead of inside the core contract.

## Artifacts and Notes

- This story is the first workflow-cohesion implementation slice after rollout controls.
- The corrected issue mapping for the feature is `#220` checkpoint contract, `#221` entry points, and `#218` next-step recommendations.

## Outcomes & Retrospective

The story is complete. `docs/WORKFLOW.md` now carries the canonical checkpoint contract, and `docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md` explicitly extends the `Review` and `Compound Capture` stages without creating a second lifecycle vocabulary.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)