---
description: 'Execution plan for story #250: bounded work-contract artifact and workflow semantics.'
---

# Execution Plan: Story #250 - Contract Workflow Artifacts

**Issue**: #250
**Author**: AgentX Auto
**Date**: 2026-03-27
**Status**: Complete

---

## Purpose / Big Picture

Implement the first story of the harness-design adoption backlog by defining the bounded work-contract artifact and teaching the workflow docs how that artifact fits into the existing checkpoint model.

## Progress

- [x] Story context reviewed
- [x] Artifact chain read
- [x] Scope narrowed to docs and template work
- [x] Contract template added
- [x] Workflow semantics updated
- [x] Validation recorded

## Surprises & Discoveries

- Observation: `docs/execution/` currently documents only plans and progress logs, so the bounded contract family needs a clear place in that taxonomy.
- Observation: `docs/WORKFLOW.md` already emphasizes avoiding a second lifecycle, which means the new contract semantics need to be expressed as `Work` internals rather than new checkpoints.

## Decision Log

- Decision: Implement story #250 as a documentation and template slice before touching runtime or extension code.
  Rationale: The story acceptance criteria are about artifact shape and workflow semantics, not runtime enforcement.
  Date/Author: 2026-03-27 / AgentX Auto

## Context and Orientation

Relevant files:

- `docs/WORKFLOW.md`
- `docs/execution/README.md`
- `.github/templates/`
- `docs/artifacts/prd/PRD-244.md`
- `docs/artifacts/adr/ADR-244.md`
- `docs/artifacts/specs/SPEC-244.md`

## Plan of Work

1. Add a new work-contract template under `.github/templates/`.
2. Add a contracts README under `docs/execution/contracts/`.
3. Update `docs/execution/README.md` to include the new artifact family.
4. Update `docs/WORKFLOW.md` to define how bounded work contracts live inside `Work` without creating a second lifecycle.
5. Validate the touched markdown files.

## Validation and Acceptance

- [x] A durable artifact shape exists for bounded work contracts.
- [x] The contract declares scope, exclusions, acceptance criteria, verification method, and recovery notes.
- [x] `docs/WORKFLOW.md` describes how contract state fits into the existing checkpoint model.

## Artifacts and Notes

- Parent epic: `#244`
- Parent feature: `#245`
- Story: `#250`
- Validation: `scripts/validate-references.ps1` now passes cleanly across the repo after correcting three stale execution-plan template links discovered during this slice.