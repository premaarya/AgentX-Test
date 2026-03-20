<!-- Inputs: {issue_number}, {title}, {date}, {author}, {agent} -->

# Execution Plan: Promptfoo-Inspired AI Evaluation Architecture

**Issue**: #235
**Author**: AgentX Auto
**Date**: 2026-03-20
**Status**: Complete

---

## Purpose / Big Picture

Define how AgentX should incorporate the strongest promptfoo ideas into its own AI project design and development workflow. Success means the repo has durable architecture artifacts that assign role ownership, define repo-local evaluation contracts, and show how AI evaluation evidence should flow through Data Scientist, Engineer, Reviewer, and Quality surfaces without turning AgentX into a standalone eval product.

This execution plan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] Implementation started
- [x] Acceptance evidence recorded

## Surprises & Discoveries

- Observation:
	AgentX already has multiple AI-evaluation primitives, but they are spread across skills, role contracts, hidden specialist guidance, deterministic harness scoring, and engineer rules rather than one first-class AI evaluation contract.
	Evidence: `.github/skills/ai-systems/ai-evaluation/SKILL.md`, `.github/agents/data-scientist.agent.md`, `.github/agents/engineer.agent.md`, `.github/agents/internal/eval-specialist.agent.md`, `vscode-extension/src/eval/harnessEvaluator.ts`
- Observation:
	Promptfoo's strongest transferable ideas are operator-facing packaging, declarative evaluation configuration, red-team support, CI/CD gating, and shareable reports, not AgentX-like orchestration.
	Evidence: `https://github.com/promptfoo/promptfoo`, promptfoo README sections on automated evaluations, red teaming, CI/CD, and result sharing

## Decision Log

- Decision:
	Treat this as an architecture slice with ADR and spec deliverables rather than a transient comparison note.
	Options Considered:
	- Keep the work as chat-only guidance
	- Create durable architecture artifacts with explicit implementation handoff guidance
	Chosen:
	Create durable architecture artifacts with explicit implementation handoff guidance
	Rationale:
	The user asked to proceed, and the next valuable output is a repo-native design that future Engineer, Data Scientist, and Reviewer work can consume.
	Date/Author:
	2026-03-20 / AgentX Auto

## Context and Orientation

Relevant repo-local context:

- `.github/skills/ai-systems/ai-evaluation/SKILL.md` already names `promptfoo` and `azure-ai-evaluation` as compatible frameworks
- `.github/agents/data-scientist.agent.md` already requires evaluation plans, judge rubrics, baselines, and multi-model comparisons
- `.github/agents/engineer.agent.md` already requires AI implementation/test phases to consume eval artifacts for `needs:ai` work
- `.github/agents/internal/eval-specialist.agent.md` already defines a hidden evaluation specialist role and quality-gate expectations
- `vscode-extension/src/eval/harnessEvaluator.ts` and its internals score workflow/harness maturity, not AI application quality

Relevant external context:

- `promptfoo` demonstrates a mature developer-facing eval product shape: declarative configs, local execution, red teaming, CI integration, model comparison, and result sharing
- Azure AI Evaluation SDK demonstrates a managed evaluator ecosystem with built-in quality, safety, RAG, and agentic evaluators plus dataset and result logging expectations

## Pre-Conditions

- [x] Issue exists and is classified
- [x] Dependencies checked (no open blockers)
- [x] Required skills identified
- [x] Complexity assessed and this task is confirmed to require a plan

## Plan of Work

Create one architecture decision record and one technical specification. The ADR will compare possible adoption shapes for promptfoo-like evaluation inside AgentX. The spec will define the selected repo-local evaluation contract, role ownership, evidence flow, operator surfaces, and phased rollout. The proposal will stay orchestration-first: AgentX remains the workflow host, while evaluation becomes a first-class evidence layer for `needs:ai` work.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Gather internal evaluation and role evidence | AgentX Auto | Complete | Skills, role contracts, hidden eval specialist, and extension evaluation surfaces reviewed |
| 2 | Gather external evaluation-product evidence | AgentX Auto | Complete | Promptfoo and Azure AI Evaluation docs reviewed |
| 3 | Write ADR with 4 options and a recommendation | AgentX Auto | Complete | Recommendation favors AgentX-native eval contract with pluggable runners |
| 4 | Write technical specification for manifests, evidence, surfaces, and rollout | AgentX Auto | Complete | No-code architecture deliverable |
| 5 | Validate docs, capture learning, and close loop | AgentX Auto | Complete | Includes errors check, loop iteration, handoff validation, and memory updates |

## Concrete Steps

- Create GitHub issue #235 for the architecture work
- Add execution plan under `docs/execution/plans/`
- Add ADR under `docs/artifacts/adr/ADR-235.md`
- Add spec under `docs/artifacts/specs/SPEC-235.md`
- Validate markdown/docs health and record evidence

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| None currently | None | N/A | Clear |

## Validation and Acceptance

- [x] ADR exists at `docs/artifacts/adr/ADR-235.md` with 3+ evaluated options and explicit recommendation
- [x] Spec exists at `docs/artifacts/specs/SPEC-235.md` with selected stack, rollout, monitoring, and role-specific ownership
- [x] Architecture stays consistent with existing Data Scientist and Engineer contracts for `needs:ai`
- [x] Proposal does not overstate current implementation state

## Idempotence and Recovery

This work is documentation-only. If validation finds structure or reference problems, update the docs and rerun validation. No runtime behavior changes until a later implementation slice.

## Rollback Plan

Remove the newly added issue-235 architecture artifacts if the design is rejected or superseded by a newer architecture decision.

## Artifacts and Notes

- GitHub issue: `#235`
- ADR: `docs/artifacts/adr/ADR-235.md`
- Spec: `docs/artifacts/specs/SPEC-235.md`
- Learning capture: `docs/artifacts/learnings/LEARNING-235.md`
- Sources:
	- `https://github.com/promptfoo/promptfoo`
	- `https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/develop/evaluate-sdk`
	- `.github/skills/ai-systems/ai-evaluation/SKILL.md`
	- `.github/agents/data-scientist.agent.md`
	- `.github/agents/engineer.agent.md`

## Outcomes & Retrospective

- Completed the architecture slice for issue `#235`.
- Chosen direction: add a repo-local AI evaluation contract with pluggable runners rather than adopting promptfoo as AgentX's primary identity.
- Key role split: Data Scientist owns evaluation design and baselines, Engineer owns execution and gating, Reviewer consumes normalized evidence, and current harness evaluation remains a separate workflow-maturity signal.
- Remaining work is implementation, not further architecture clarification.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)