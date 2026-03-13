---
id: LEARNING-163
title: Use a five-phase knowledge-compounding lifecycle
category: workflow-contract
subcategory: compound-capture
phases: planning,review,capture
validation: approved
evidence: high
mode: shared
keywords: workflow,compound capture,review,handoff,artifacts,plan,progress,reuse
sources: docs/artifacts/adr/ADR-163.md,docs/artifacts/specs/SPEC-163.md,docs/artifacts/prd/PRD-157.md
---

## Summary

Treat knowledge compounding as a formal lifecycle that runs through plan, design, execute, review, and compound capture, with capture resolved after review instead of being left implicit.

## Guidance

- Anchor the workflow on artifact families rather than host-specific commands or one client surface.
- Reuse existing AgentX issue, plan, progress, review, and design artifacts instead of inventing a sidecar tracker for learnings.
- Resolve capture as mandatory, optional, or skip after review so reusable guidance is preserved only when evidence is strong enough.

## Use When

- Defining planning and review handoff behavior.
- Deciding whether a finished work item should produce a curated learning artifact.
- Explaining where compound capture fits in the AgentX lifecycle.

## Avoid

- Closing work with no explicit capture decision when a reusable pattern was created.
- Creating a second backlog or state machine for knowledge artifacts.
