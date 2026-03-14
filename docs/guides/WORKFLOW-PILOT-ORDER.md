# Workflow Pilot Order

This guide defines the bounded rollout order and exit criteria for epic #215.

## Pilot Sequence

1. Workflow cohesion
2. Task bundles
3. Bounded parallel delivery
4. Skill packaging
5. Portability generation

## Exit Criteria

### Workflow cohesion

- Shared checkpoint language is visible across the shipped workflow surfaces.
- Work and Status show the same next-step payload.
- Plan-deepening and review-kickoff entry points preserve issue and plan context.
- The rollout scorecard and operator checklist both exist and match the shipped surfaces.
- A rollback or containment path is documented before moving to task bundles.

### Later slices

- The prior slice remains stable during pilot review.
- The prior slice has an explicit recovery path.
- The next slice references the scorecard row and dependency that made it eligible.

## Recovery Rule

If a slice fails its exit criteria, contain rollout to the prior stable slice and keep later slices blocked until the control artifacts are repaired.