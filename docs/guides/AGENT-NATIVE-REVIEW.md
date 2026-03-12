# Agent-Native Review Guidance

## Purpose

This guide defines how AgentX should evaluate whether user-visible review-time actions and context are equally available to agents.

## Review Lens

Agent-native review is architectural and workflow-focused. It does not score naming style, formatting taste, or subjective implementation preferences.

The review asks three questions:

1. Action parity: can agents reach the same high-value review-time actions that users can trigger?
2. Context parity: do agents and users operate on the same workspace, issue, plan, review, and state context?
3. Shared workspace expectations: do both paths resolve the same repo-local artifacts, guidance, and workflow contracts?

## Capability Map

| Capability | User Surface | Agent Surface | Shared Artifacts | Why It Matters |
|------------|--------------|---------------|------------------|----------------|
| Workflow execution | Command palette, Work sidebar | `@agentx run ...` | issue, plan, workflow state | Review findings are weak if agents cannot trigger the same delivery flow |
| Review learnings retrieval | Command palette, Work sidebar | `@agentx learnings review ...` | `docs/learnings/` | Review should reuse prior solutions without user-only lookup steps |
| Knowledge capture guidance | Command palette, Work sidebar | `@agentx capture guidance` | `docs/guides/KNOWLEDGE-CAPTURE.md`, `docs/learnings/` | Reusable outcomes should be preserved consistently after review |

## Scoring Rubric

### Action Parity

- 100%: every mapped capability is available in both user and agent surfaces
- 50-99%: at least one mapped capability is missing from one side
- 0-49%: review-time actions are materially user-only or agent-only

### Context Parity

- 100%: workspace root, pending clarification state, execution plan access, and state-file access are shared
- 50-99%: one shared context dependency is missing or indirect
- 0-49%: user and agent flows rely on different context models

### Shared Workspace Expectations

- 100%: review guidance, templates, and review surfaces all point at the same repo-local contract
- 50-99%: one contract artifact or review surface is missing
- 0-49%: review output depends on disconnected or host-specific assumptions

## Severity Model

- High: a user-visible review capability is not reachable for agents, or vice versa
- Medium: the capability exists, but shared context or contract artifacts are missing
- Low: the parity path exists but is weakly documented or exposed in only one minor surface
- None: no parity gap detected

## Output Expectations

Agent-native review output should include:

- a capability map
- per-pillar scores for action parity, context parity, and shared workspace expectations
- concrete findings that point to architectural gaps
- an advisory-first recommendation, not an immediate hard gate

## Notes

- Local and GitHub-backed workflows should use the same artifact-based contract even when storage or status plumbing differs.
- Findings should identify workflow debt and parity gaps, not restate generic code review concerns already covered elsewhere.
