---
description: 'Execution plan for story #251: contract-aware workflow guidance in extension operator surfaces.'
---

# Execution Plan: Story #251 - Contract-Aware Operator Surfaces

**Issue**: #251
**Author**: AgentX Auto
**Date**: 2026-03-28
**Status**: Complete

---

## Purpose / Big Picture

Use the shared workflow-guidance snapshot to expose active bounded-slice state across extension operator surfaces without introducing per-surface inference drift.

## Progress

- [x] Surface inventory reviewed
- [x] Shared workflow guidance snapshot extended with contract state
- [x] Sidebar guidance surface updated
- [x] Regression coverage added
- [x] Validation recorded

## Surprises & Discoveries

- Observation: Chat and command surfaces were already reusing the workflow guidance renderer, so the main missing evidence was explicit sidebar-level contract state coverage.

## Validation and Acceptance

- [x] Target extension/operator surfaces for contract state are defined.
- [x] Guidance explains current slice state, next move, and blockers.
- [x] The design reuses shared guidance logic instead of per-surface inference drift.