---
title: Isolated Task-Unit Contract Implementation
status: Complete
owner: Solution Architect Agent
last_updated: 2026-03-13
---

# Execution Plan: Isolated Task-Unit Contract

**Issue**: #224
**Epic**: #215
**Feature**: #226

## Purpose / Big Picture

Define the contract for each isolated bounded-parallel work item so scope, ownership, isolation, status, merge readiness, and recovery are durable and visible from the parent plan.

## Progress

- [x] Story intent and acceptance criteria reviewed
- [x] Dependency on eligibility rubric identified
- [x] Required task-unit fields identified
- [x] Parent-summary and recovery expectations identified
- [x] Story specification published
- [x] Progress log updated

## Surprises & Discoveries

- Observation: Parent-plan summarization is a core requirement, not a derived convenience.
  Evidence: Story #224 requires parent plans to summarize unit health without opening each unit in full.

## Decision Log

- Decision: Keep merge readiness separate from unit status.
  Options Considered: One combined lifecycle field; separate unit status and merge-readiness fields.
  Chosen: Separate fields.
  Rationale: A unit can be healthy but not merge-ready, or complete but still unsafe to reconcile.
  Date/Author: 2026-03-13 / GitHub Copilot

## Context and Orientation

Key files and artifacts:

- `docs/artifacts/specs/SPEC-229.md`
- `docs/artifacts/specs/SPEC-224.md`
- `docs/artifacts/specs/SPEC-215.md`
- `docs/artifacts/adr/ADR-215.md`

Constraints:

- The contract must stay compatible with current AgentX workflow and artifact families.
- Recovery expectations must be explicit.
- Parent plans must be able to summarize unit health compactly.

## Plan of Work

Define the minimum task-unit contract, including isolation mode, status, merge readiness, and recovery guidance. Publish the result as the bounded-parallel unit baseline for later reconciliation work.

## Steps

| Step | Action | Owner | Status | Notes |
|------|--------|-------|--------|-------|
| 1 | Review story #224 and the feature #226 scope | Solution Architect Agent | Complete | Contract boundary confirmed |
| 2 | Define unit identity, scope, ownership, isolation, and health fields | Solution Architect Agent | Complete | Minimum contract established |
| 3 | Define recovery and parent-summary expectations | Solution Architect Agent | Complete | Parent visibility preserved |
| 4 | Publish the story-level technical specification | Solution Architect Agent | Complete | `SPEC-224.md` |
| 5 | Record progress and next dependency notes | Solution Architect Agent | Complete | Reconciliation story #228 now has a stable unit contract |

## Validation and Acceptance

- [x] The task-unit contract records scope, owner, isolation mode, status, and merge readiness
- [x] Recovery and retry expectations are documented
- [x] Parent plans can summarize unit health without opening each unit in full
- [x] The design stays compatible with standard AgentX workflow and artifact families

## Outcomes & Retrospective

The task-unit contract is complete and published as `docs/artifacts/specs/SPEC-224.md`. Later bounded parallel delivery work should treat this contract as the minimum isolated-unit baseline for execution and reconciliation.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)