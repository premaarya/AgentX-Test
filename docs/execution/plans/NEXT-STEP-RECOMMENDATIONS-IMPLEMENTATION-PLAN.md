---
title: Next Step Recommendations Implementation
status: Draft
owner: Product Manager
last_updated: 2026-03-13
---

# Execution Plan: Next Step Recommendations Implementation

**Issue**: #218
**Epic**: #215
**Feature**: #214

## Purpose / Big Picture

Define the advisory recommendation model that tells operators what to do next from current artifact state. The result should explain how recommendations are resolved from deterministic evidence, how ambiguity is surfaced safely, and how at least the Work and Status surfaces can present the same guidance without hidden side effects.

## Progress

- [x] Story intent grounded in PRD-215, ADR-215, and SPEC-215
- [x] Dependency on rollout controls and checkpoint contract identified
- [x] Initial implementation plan drafted
- [ ] Recommendation evidence model agreed
- [ ] Ambiguity and missing-evidence behavior agreed
- [ ] Surface-output contract agreed
- [ ] Story-ready documentation checklist approved

## Surprises & Discoveries

- Observation: The recommendation engine is already a first-class phase-one component in the approved architecture, but it is explicitly advisory rather than stateful control logic.
  Evidence: `docs/artifacts/specs/SPEC-215.md` sections 3.2 and 4.1.
- Observation: Performance expectations require recommendations to be lightweight and based on existing evidence rather than broad repo scans.
  Evidence: `docs/artifacts/specs/SPEC-215.md` section 8.
- Observation: The hardest product risk is false certainty when artifact evidence is incomplete.
  Evidence: The error-handling contract in SPEC-215 requires ambiguity to be surfaced instead of guessed.

## Decision Log

- Decision: Resolve recommendations from deterministic artifact evidence first, with optional AI synthesis layered on top later.
  Options Considered: AI-only recommendations; deterministic evidence only; deterministic evidence with optional AI synthesis.
  Chosen: Deterministic evidence with optional later AI synthesis.
  Rationale: This matches the initiative's advisory-first architecture and keeps behavior testable.
  Date/Author: 2026-03-13 / GitHub Copilot
- Decision: Treat missing evidence as an explicit ambiguous state instead of inferring the next step optimistically.
  Options Considered: Best-guess recommendation; explicit ambiguity state; manual-only fallback.
  Chosen: Explicit ambiguity state.
  Rationale: Operators need trustworthy guidance, and the control plane is designed to fail closed when evidence is missing.
  Date/Author: 2026-03-13 / GitHub Copilot

## Context and Orientation

Key files and artifacts:

- `docs/artifacts/prd/PRD-215.md`
- `docs/artifacts/adr/ADR-215.md`
- `docs/artifacts/specs/SPEC-215.md`
- `docs/execution/plans/WORKFLOW-CHECKPOINT-CONTRACT-IMPLEMENTATION-PLAN.md`
- `docs/execution/progress/WORKFLOW-CHECKPOINT-CONTRACT-IMPLEMENTATION-PROGRESS.md`
- `docs/execution/plans/ROLLOUT-SCORECARD-IMPLEMENTATION-PLAN.md`
- `docs/WORKFLOW.md`

Constraints:

- Recommendations must remain side-effect free and advisory-first.
- Work and Status surfaces must be able to show the same recommendation contract.
- The model must react to plan, review, and compound evidence already present in the repo.
- Recommendation resolution must stay lightweight and based on existing artifacts.

## Plan of Work

Define the evidence inputs that determine the current checkpoint and the next recommended action. Document the decision rules, ambiguous-state handling, and the normalized recommendation payload that multiple surfaces can present consistently. Finish by linking the recommendation model back to the checkpoint contract and rollout review process.

## Steps

| Step | Action | Owner | Status | Notes |
|------|--------|-------|--------|-------|
| 1 | Define the evidence inputs that can drive recommendations | Product Manager | Not Started | Plan, review, compound, issue, and status evidence |
| 2 | Define deterministic recommendation rules by checkpoint and missing-evidence case | Product Manager | Not Started | No hidden side effects |
| 3 | Define the normalized recommendation payload for surfaces | Product Manager | Not Started | Same guidance on Work and Status |
| 4 | Define ambiguity, warning, and operator-recovery behavior | Product Manager | Not Started | Fail closed |
| 5 | Link the recommendation model into phase-one rollout reviews | Product Manager | Not Started | Keep guidance measurable |

## Concrete Steps

- Draft a recommendation matrix with evidence input, inferred checkpoint, recommended next action, and ambiguity behavior.
- Cross-check the matrix against the checkpoint contract and rollout scorecard expectations.
- Define the minimum common output fields surfaces must display.
- Document how to test recommendation correctness without runtime side effects.

## Dependencies

- Story `#219` rollout scorecard should remain the rollout gate.
- Story `#220` checkpoint contract should define the checkpoint vocabulary first.
- Story `#221` entry-point design should share the same surface language where relevant.

## Validation and Acceptance

- [ ] Work and Status surfaces can show the same recommendation contract from current artifact state
- [ ] Recommendations change based on plan, review, and compound evidence already present in the repo
- [ ] The guidance remains advisory-first and does not silently trigger side effects
- [ ] The recommendation model is documented, explicit, and testable
- [ ] Ambiguous or incomplete evidence produces a safe, explainable outcome

## Idempotence and Recovery

This story is safe to iterate because it defines a recommendation contract before any runtime implementation. If a recommendation rule is too brittle, it can be narrowed or deferred without breaking the underlying checkpoint model.

## Rollback Plan

If recommendation logic becomes too broad for phase one, reduce the model to the minimal checkpoints and evidence cases needed by Work and Status surfaces, then expand after rollout reviews show stable operator value.

## Artifacts and Notes

- This story should follow the checkpoint contract and can overlap with entry-point planning only after vocabulary is stable.
- The corrected phase-one sequence is `#219` rollout scorecard -> `#220` checkpoint contract -> `#221` entry points -> `#218` recommendations.

## Outcomes & Retrospective

The planning slice is complete. The next action is to author the durable recommendation contract so implementation can deliver consistent guidance across operator surfaces without inventing hidden workflow logic.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)