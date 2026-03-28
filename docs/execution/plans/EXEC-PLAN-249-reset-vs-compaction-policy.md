---
description: 'Execution plan for story #249: reset-vs-compaction policy for long-running work.'
---

# Execution Plan: Story #249 - Reset Vs Compaction Policy

**Issue**: #249
**Author**: AgentX Auto
**Date**: 2026-03-28
**Status**: Complete

---

## Purpose / Big Picture

Define an explicit artifact-first policy for continue, compact, or clean reset decisions during long-running work.

## Progress

- [x] Story context reviewed
- [x] Existing runner compaction and loop behavior inspected
- [x] Policy guide added
- [x] Workflow documentation updated
- [x] Validation recorded

## Surprises & Discoveries

- Observation: The runner already has compaction and stale-loop reset behavior; the missing piece is a durable decision policy, not a new runtime mechanism.
- Observation: The right abstraction is provider-aware context pressure and artifact freshness, not model-specific branching.

## Plan of Work

1. Document the decision order for continue, compact, and reset.
2. Define the artifact-first inputs that should drive the decision.
3. Add workflow language that keeps the policy provider-aware without hardcoding one model family.
4. Validate the new guide and links.

## Validation and Acceptance

- [x] Policy factors are defined for continue, compact, or clean reset decisions.
- [x] The policy uses durable artifact state rather than chat history alone.
- [x] The design remains provider-aware without hardcoding one model family.