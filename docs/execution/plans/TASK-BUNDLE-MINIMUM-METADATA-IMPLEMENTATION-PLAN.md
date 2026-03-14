---
title: Task Bundle Minimum Metadata Implementation
status: Complete
owner: Solution Architect Agent
last_updated: 2026-03-13
---

# Execution Plan: Task Bundle Minimum Metadata

**Issue**: #230
**Epic**: #215
**Feature**: #227

## Purpose / Big Picture

Define the minimum repo-local metadata contract for task bundles so decomposed work can be tracked, reviewed, promoted, or archived without becoming a second backlog. This story should establish the smallest durable schema needed for traceability and later operator surfaces.

## Progress

- [x] Story intent grounded in PRD-215, ADR-215, SPEC-215, and feature #227 scope
- [x] Parent feature and acceptance criteria reviewed from the live GitHub backlog
- [x] Minimum metadata categories identified
- [x] Workflow-state mapping approach identified
- [x] Promotion-mode placeholder boundary identified
- [x] Story specification published
- [x] Progress log updated for handoff

## Surprises & Discoveries

- Observation: The feature scope already assumes task bundles stay subordinate to the normal backlog rather than becoming a peer tracker.
  Evidence: GitHub feature #227 description and PRD-215 later-phase backlog.
- Observation: The smallest safe contract still needs explicit parent context and evidence links, or later promotion and searchability will drift.
  Evidence: Issue #230 acceptance criteria require both traceability and later operator-surface support.
- Observation: Bundle states should mostly reuse the existing AgentX workflow vocabulary, with only minimal bundle-only substates.
  Evidence: `docs/WORKFLOW.md` and PRD-215 both prefer additive, no-second-state-machine expansion.

## Decision Log

- Decision: Keep the task-bundle design story at the specification layer and reuse epic ADR-215 rather than introducing a new story-specific ADR.
  Options Considered: Story-specific ADR plus spec; spec-only under the initiative ADR; implementation-first placeholder contract.
  Chosen: Spec-only under ADR-215.
  Rationale: The initiative ADR already defines task bundles as a later decomposition substrate. This story needs the concrete contract, not a new top-level architectural branch.
  Date/Author: 2026-03-13 / GitHub Copilot
- Decision: Use `Proposed` and `Archived` as the only bundle-only substates in the minimum contract.
  Options Considered: Full custom bundle lifecycle; direct reuse of only standard issue states; minimal shared lifecycle plus two bundle-only substates.
  Chosen: Minimal shared lifecycle plus two bundle-only substates.
  Rationale: This keeps the contract additive while still covering pre-activation and searchable post-closure behavior.
  Date/Author: 2026-03-13 / GitHub Copilot

## Context and Orientation

Key files and artifacts:

- `docs/artifacts/prd/PRD-215.md`
- `docs/artifacts/adr/ADR-215.md`
- `docs/artifacts/specs/SPEC-215.md`
- `docs/artifacts/specs/SPEC-230.md`
- `docs/WORKFLOW.md`
- `docs/execution/plans/COMPOUND-WORKFLOW-AND-PORTABILITY-PLAN.md`

Constraints:

- The contract must be repo-local and ASCII-safe.
- The issue hierarchy remains the source of truth.
- Bundle metadata must be sufficient for later promotion rules and operator surfaces.
- The contract must avoid inventing a second workflow state machine.

## Plan of Work

Define the minimum task-bundle metadata categories, map the bundle lifecycle to current AgentX workflow states with only minimal new substates, and reserve only the smallest set of additive fields needed for later promotion and search. Publish the result as a story-level technical specification and align the execution artifacts so later stories can build on a stable contract.

## Steps

| Step | Action | Owner | Status | Notes |
|------|--------|-------|--------|-------|
| 1 | Review story #230 and parent feature #227 | Solution Architect Agent | Complete | Acceptance criteria confirmed |
| 2 | Define minimum metadata categories and required fields | Solution Architect Agent | Complete | Parent context, priority, state, owner, evidence links, promotion mode |
| 3 | Define state mapping and minimal bundle-only substates | Solution Architect Agent | Complete | `Proposed` and `Archived` only |
| 4 | Publish story-level technical specification | Solution Architect Agent | Complete | `SPEC-230.md` |
| 5 | Record durable progress and handoff context | Solution Architect Agent | Complete | Progress log updated |

## Concrete Steps

- Anchor the story in epic #215 and feature #227.
- Define the required metadata table and conceptual model.
- Define state mapping and promotion-mode placeholders.
- Bound the non-goals so later stories own promotion flows and operator commands.
- Update the progress log with the published contract and next dependency order.

## Dependencies

- Feature #227 task-bundle scope
- Epic #215 control-plane rules
- Story #225 for promotion paths
- Story #223 for operator surfaces

## Validation and Acceptance

- [x] Parent context, priority, state, owner, evidence links, and promotion mode are all represented
- [x] Bundle states map to AgentX workflow states or clearly documented substates
- [x] The contract stays repo-local and ASCII-safe
- [x] The design supports later operator surfaces without creating a second backlog

## Idempotence and Recovery

This story is safe to iterate because it is a documentation and contract-definition slice. If later promotion or command stories reveal a gap, additive reserved fields can extend the contract without invalidating early bundle records.

## Rollback Plan

If the contract becomes too broad, reduce it back to the required-field set and move non-essential metadata into reserved optional fields so later implementation stays aligned to the issue acceptance criteria.

## Artifacts and Notes

- This is the first task-bundle story in phase two.
- The next logical dependency after this story is #225, which will define promotion paths over the metadata contract established here.

## Outcomes & Retrospective

The architectural contract is complete and published as `docs/artifacts/specs/SPEC-230.md`. Follow-on stories should treat this document as the minimum metadata baseline for all task-bundle surfaces and promotion logic.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)