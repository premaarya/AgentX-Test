---
id: LEARNING-162
title: Separate curated learnings from runtime observations
category: memory
subcategory: retrieval-ranking
phases: planning,review
validation: approved
evidence: high
mode: shared
keywords: learnings,metadata,ranking,retrieval,planning,review,observations
sources: docs/adr/ADR-162.md,docs/specs/SPEC-162.md,docs/prd/PRD-157.md
---

## Summary

Use curated durable learnings as the retrieval unit for planning and review, and treat runtime observations as supporting evidence or source material rather than the final reusable artifact.

## Guidance

- Filter candidate learnings by category, lifecycle phase, validation state, and mode before ranking them.
- Keep ranking deterministic and explainable through metadata, keyword overlap, evidence strength, validation state, recency, and reuse signal.
- Require source references so a surfaced learning can be checked against the issue, ADR, spec, review, or other evidence that supports it.

## Use When

- Designing or reviewing planning-entry retrieval behavior.
- Designing or reviewing review-entry retrieval behavior.
- Deciding whether a new solved problem should become a curated learning record.

## Avoid

- Treating every runtime observation or session note as durable institutional knowledge.
- Letting semantic or model-only ranking hide why a result surfaced before metadata-first quality is proven.
