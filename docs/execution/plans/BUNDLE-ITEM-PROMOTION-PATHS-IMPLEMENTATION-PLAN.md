---
title: Bundle Item Promotion Paths Implementation
status: Complete
owner: Solution Architect Agent
last_updated: 2026-03-13
---

# Execution Plan: Promotion Paths From Bundle Items

**Issue**: #225
**Epic**: #215
**Feature**: #227

## Purpose / Big Picture

Define how a task-bundle item either remains local, promotes into a story or feature, or becomes a durable review finding while preserving a searchable local history and avoiding duplicate backlog entries.

## Progress

- [x] Story intent and acceptance criteria reviewed
- [x] Dependency on story #230 minimum metadata identified
- [x] Promotion destinations defined
- [x] De-duplication boundary defined
- [x] Story specification published
- [x] Progress log updated

## Surprises & Discoveries

- Observation: Promotion design is primarily a source-of-truth problem, not just a routing problem.
  Evidence: Story #225 acceptance criteria explicitly keep the normal issue hierarchy authoritative.
- Observation: Searchable local closure after promotion is part of the contract, not just a convenience.
  Evidence: The story requires promoted work to remain searchable after elevation.

## Decision Log

- Decision: Default to remaining local unless a durable tracking threshold is met.
  Options Considered: Promote by default; remain local by default; auto-promote everything that looks actionable.
  Chosen: Remain local by default.
  Rationale: This avoids turning bundle decomposition into backlog inflation.
  Date/Author: 2026-03-13 / GitHub Copilot

## Context and Orientation

Key files and artifacts:

- `docs/artifacts/specs/SPEC-230.md`
- `docs/artifacts/specs/SPEC-225.md`
- `docs/artifacts/specs/SPEC-215.md`
- `docs/artifacts/adr/ADR-215.md`

Constraints:

- Duplicate durable backlog items must be avoided by default.
- Searchable local history must remain after promotion.
- Promotion must preserve the standard AgentX issue hierarchy as source of truth.

## Plan of Work

Define the promotion destinations, the default remain-local rule, the de-duplication guardrails, and the searchable post-promotion trail. Publish the result as a story-level specification that later operator-surface work can implement safely.

## Steps

| Step | Action | Owner | Status | Notes |
|------|--------|-------|--------|-------|
| 1 | Review story #225 and dependency on story #230 | Solution Architect Agent | Complete | Metadata prerequisite confirmed |
| 2 | Define promotion destinations and threshold rules | Solution Architect Agent | Complete | Local, story, feature, durable review finding |
| 3 | Define de-duplication and searchable-history rules | Solution Architect Agent | Complete | Link existing by default |
| 4 | Publish the story-level technical specification | Solution Architect Agent | Complete | `SPEC-225.md` |
| 5 | Record progress and next dependencies | Solution Architect Agent | Complete | Story #223 now has a stable promotion contract |

## Validation and Acceptance

- [x] Promotion rules define local, story, feature, and durable review-finding outcomes
- [x] Duplicate backlog entries are avoided by default
- [x] Closed or promoted work remains searchable after promotion
- [x] Durable tracking remains anchored in the normal issue hierarchy

## Outcomes & Retrospective

The promotion-path contract is complete and published as `docs/artifacts/specs/SPEC-225.md`. Later bundle-management work should treat this contract as the durable routing model from local decomposition into standard AgentX tracking.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)