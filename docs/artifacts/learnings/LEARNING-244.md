# LEARNING-244: strengthen Work with contracts and shared evidence instead of adding a second lifecycle

**Date**: 2026-03-28
**Issue**: #244
**Category**: Workflow
**Status**: Curated

## Context

AgentX already had a durable workflow vocabulary, plan/progress artifacts, loop state, review artifacts, and extension guidance. The rollout question for epic `#244` was whether to add a separate harness lifecycle or make the existing `Work` checkpoint explicit enough to support bounded slices, evaluator findings, and runtime proof.

## Learning

The higher-leverage path is:

- keep the existing checkpoint model as the only lifecycle vocabulary
- introduce bounded work contracts as nested `Work` artifacts
- attach implementation, verification, and runtime evidence to those slices explicitly
- persist active contract state beside existing harness thread state rather than creating a second runtime file family
- render contract state through shared workflow guidance so chat, commands, and sidebars stay aligned

## Why It Matters

- It improves long-running task legibility without splitting operator understanding across two state machines.
- It keeps runtime, docs, and operator surfaces aligned around the same contract and evidence model.
- It makes evaluator feedback and runtime proof usable before final review rather than only after implementation is effectively done.

## Reuse Guidance

- When a workflow already has a stable lifecycle vocabulary, strengthen the active checkpoint with better contracts and evidence before inventing new top-level states.
- Persist new slice-level state inside the existing runtime control plane whenever the thread/turn model already provides the right anchors.
- Use one normalized guidance surface for contract path, status, blocker, next action, and finding summary; do not let each UI surface infer these independently.
- For release validation, treat failing harness code as real product risk: fix the test harness when it is the source of false negatives, then rerun the true end-to-end path.

## Supporting Artifacts

- `docs/artifacts/prd/PRD-244.md`
- `docs/artifacts/adr/ADR-244.md`
- `docs/artifacts/specs/SPEC-244.md`
- `docs/artifacts/reviews/REVIEW-244.md`
- `docs/testing/CERT-244.md`
- `docs/execution/contracts/README.md`