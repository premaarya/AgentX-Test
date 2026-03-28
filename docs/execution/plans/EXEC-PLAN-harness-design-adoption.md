---
description: 'Execution plan for adopting contract-driven harness design in AgentX.'
---

# Execution Plan: AgentX Harness Design Adoption

**Issue**: Local task
**Author**: AgentX Auto
**Date**: 2026-03-27
**Status**: Draft

---

## Purpose / Big Picture

Adopt the most useful harness-design concepts from Anthropic's long-running application-development article into AgentX without overfitting to one model generation or creating a second competing workflow system. Success means AgentX gains a contract-driven implementation loop, clearer separation between implementation and evaluation, stronger runtime evidence expectations, and an explicit strategy for when to use durable handoffs, compaction, or clean-slate resets.

This execution plan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [ ] Design review completed
- [ ] Implementation started
- [ ] Acceptance evidence recorded

## Surprises & Discoveries

- Observation: AgentX already has many harness primitives documented and partially implemented, including checkpoints, plan/progress artifacts, loop gating, and file-backed harness threads.
  Evidence: `docs/WORKFLOW.md`, `vscode-extension/src/utils/workflowGuidance.ts`, `vscode-extension/src/utils/harnessState.ts`
- Observation: The current gap is not lack of workflow vocabulary, but lack of a first-class contract negotiation and evaluator loop inside the `Work` checkpoint.
  Evidence: `docs/WORKFLOW.md` checkpoint definitions and transition rules emphasize plan/review evidence, but do not define a bounded slice contract between implementation and evaluation.
- Observation: AgentX already distinguishes durable evidence from chat history in several surfaces, which makes it a good fit for a more explicit harness contract.
  Evidence: `vscode-extension/src/utils/workflowGuidance.ts` resolves checkpoint state from issue, plan, review, loop, and learning artifacts rather than transcript state.
- Observation: Runtime enforcement is intentionally partial today, so the adoption plan needs staged rollout and proof points rather than a single large enforcement drop.
  Evidence: `docs/WORKFLOW.md`, `docs/QUALITY_SCORE.md`, and `docs/tech-debt-tracker.md` all describe plan/evidence enforcement as incomplete.

## Decision Log

- Decision: Treat this work as a harness-evolution initiative, not as a narrow extension-only feature.
  Options Considered: extension-only update; CLI-only update; cross-surface harness adoption.
  Chosen: cross-surface harness adoption.
  Rationale: The harness contract spans docs, CLI/runtime behavior, extension guidance, commands, and review/test surfaces.
  Date/Author: 2026-03-27 / AgentX Auto
- Decision: Introduce contract-driven implementation inside the existing checkpoint model instead of creating a new parallel state machine.
  Options Considered: new dedicated harness lifecycle; checkpoint augmentation.
  Chosen: checkpoint augmentation.
  Rationale: AgentX already has a durable checkpoint vocabulary. Reusing it reduces operator confusion and migration risk.
  Date/Author: 2026-03-27 / AgentX Auto
- Decision: Make evaluator participation selective and load-bearing only where task complexity exceeds reliable solo execution.
  Options Considered: mandatory evaluator on every task; evaluator only at final review; adaptive evaluator usage.
  Chosen: adaptive evaluator usage.
  Rationale: The article's strongest operational lesson is that harness parts should be retained only while they add measurable lift.
  Date/Author: 2026-03-27 / AgentX Auto

## Context and Orientation

Relevant repo-local context:

- `docs/WORKFLOW.md` defines the canonical checkpoint model, transition rules, execution-plan requirements, and evidence expectations.
- `AGENTS.md` defines role contracts, phase ordering, and quality-loop requirements.
- `vscode-extension/src/utils/workflowGuidance.ts` resolves checkpoint state from durable repo evidence.
- `vscode-extension/src/utils/harnessState.ts` exposes file-backed harness thread and turn management.
- `.agentx/agentic-runner.ps1` is the shared runtime surface for long-running agent execution, compaction, clarification, and loop enforcement.
- `vscode-extension/src/review/`, `vscode-extension/src/eval/`, `vscode-extension/src/commands/`, and `vscode-extension/src/views/` already provide seams for evaluator-facing commands and sidebar/status presentation.

Primary constraints:

- Preserve the existing checkpoint vocabulary: `Brainstorm`, `Plan`, `Work`, `Review`, `Compound Capture`, `Done`.
- Keep AgentX Auto as the top-level orchestrator rather than introducing a new top-level role.
- Avoid duplicating issue status, checkpoint state, and harness state into multiple uncoordinated files.
- Prefer staged adoption with measurable evidence over a large one-shot workflow rewrite.
- Maintain ASCII-only documentation and source artifacts.

## Pre-Conditions

- [ ] Issue exists and is classified
- [x] Dependencies checked (no open blockers for planning)
- [x] Required skills identified
- [x] Complexity assessed and this task is confirmed to require a plan

## Problem Statement

AgentX already has a strong workflow vocabulary and durable artifact model, but its implementation loop still leans heavily on phase boundaries rather than explicit contract negotiation and evaluator-driven iteration during `Work`. That creates three main gaps:

1. Work slices are not consistently converted into testable contracts before coding starts.
2. Evaluation is stronger at review time than during implementation time.
3. Evidence-backed runtime validation is described in policy more strongly than it is enforced in runtime behavior.

The goal of this effort is to close those gaps while preserving the parts of AgentX that already work well: role contracts, durable artifacts, issue-first workflow, and repo-local state.

## Proposed Design

### Design Goals

- Add a contract-first inner loop inside `Work`.
- Keep planning and review durable and resumable across sessions.
- Separate implementation from evaluation so self-grading is not the only control.
- Make runtime verification an explicit part of acceptance where applicable.
- Allow the harness to simplify as model capability improves.

### Non-Goals

- Do not replace the existing AgentX checkpoint model.
- Do not require evaluator loops for every small bug or docs task.
- Do not hardcode one provider or one model family into the harness contract.
- Do not require a second issue tracker or sidecar lifecycle.

### Target Architecture

The target harness adds a bounded inner loop to the existing checkpoint model:

1. `Planner` or planning-capable phase deepens scope into a durable execution plan.
2. `Implementer` proposes a bounded slice contract before making changes.
3. `Evaluator` reviews the slice contract and either approves it or requests adjustments.
4. `Implementer` builds the approved slice.
5. `Evaluator` validates the slice against explicit contract criteria and runtime evidence.
6. The system either advances to the next slice or loops with concrete findings.

The outer lifecycle remains unchanged:

- `Brainstorm` shapes scope.
- `Plan` anchors durable execution.
- `Work` becomes contract-driven and evaluator-aware.
- `Review` remains the broader correctness/risk gate.
- `Compound Capture` preserves reusable learning.

### Harness Roles

- `Planner`
  - Produces or deepens durable execution plans.
  - Stays high-level enough to avoid brittle over-specification.
- `Implementer`
  - Owns code changes and proposes slice contracts.
  - Must state intended proof before implementation begins.
- `Evaluator`
  - Reviews contracts before implementation.
  - Validates actual outcomes after implementation.
  - Emits concrete findings, not only pass/fail labels.

In AgentX, these are harness roles, not necessarily new standalone user-visible agents. They will usually be fulfilled by existing roles:

- Planner -> PM, Architect, or AgentX Auto planning phase
- Implementer -> Engineer or equivalent specialist phase
- Evaluator -> Reviewer, Tester, or targeted evaluator/test surface

### Contract Model

Each implementation slice should define a durable contract with:

- slice name and purpose
- files and surfaces likely to change
- bounded scope and explicit exclusions
- acceptance criteria
- proof requirements
- runtime verification approach
- rollback/recovery note

Recommended artifact location:

- `docs/execution/contracts/CONTRACT-<context>-<slice>.md`

Minimum contract sections:

- Purpose
- Scope
- Not In Scope
- Acceptance Criteria
- Verification Method
- Runtime Evidence Expectations
- Risks
- Recovery Path

### Evidence Model

Each completed slice should be able to point to three evidence classes:

- implementation evidence
  - changed files, generated artifacts, or saved outputs
- verification evidence
  - tests, command outputs, static checks, lint/build status
- runtime evidence
  - UI walkthroughs, API responses, log traces, screenshots, or evaluator findings

Evidence should remain repo-local where practical, with summaries stored in plan/progress artifacts and richer outputs stored under existing artifact families.

### Context Strategy

The harness should support both:

- compaction when the model sustains long tasks well
- structured reset with durable handoff when coherence degrades or context anxiety appears

This requires an explicit policy layer in runtime surfaces rather than relying only on prompt wording. The policy should eventually consider:

- model family
- task duration
- artifact availability
- pending evaluator findings
- current checkpoint and slice state

### Evaluator Strategy

Evaluator use should be adaptive, not unconditional.

Default guidance:

- Small bug/docs changes: evaluator optional or final-review-only.
- Multi-file, UX-sensitive, AI-heavy, or workflow-critical changes: evaluator active inside `Work`.
- High-risk or runtime-heavy changes: evaluator should include surface-level verification, not just file review.

### Runtime and Operator Surfaces

Planned surfaces to align:

- `docs/WORKFLOW.md`: contract-driven `Work` semantics and reset/compaction guidance
- `.agentx/agentic-runner.ps1`: contract state, evaluator loop, and context policy hooks
- `vscode-extension/src/utils/workflowGuidance.ts`: checkpoint guidance that understands contract state
- extension commands/views/chat: operator entry points for contract creation, evaluation kickoff, and evidence visibility

## Plan of Work

This work should proceed in five implementation waves.

Wave 1 establishes the contract and artifact model in docs and templates. Wave 2 introduces runtime support for contract-aware execution and evaluator feedback inside `Work`. Wave 3 extends extension guidance, commands, and sidebars so the operator can see and drive the new loop. Wave 4 adds stronger runtime verification and evidence collection on representative surfaces. Wave 5 evaluates which scaffolding remains load-bearing, simplifying where newer model/runtime capability makes earlier controls redundant.

Each wave must leave the repo in a usable state. No wave should depend on a future total rewrite.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Finalize architecture intent and acceptance targets | AgentX Auto | In Progress | Current planning step |
| 2 | Add contract artifact template and workflow-doc updates | AgentX Auto | Not Started | Establish durable contract model |
| 3 | Add runner-side contract state and evaluator-loop plumbing | AgentX Auto | Not Started | Extend `.agentx/agentic-runner.ps1` and related runtime surfaces |
| 4 | Add extension guidance for contract-aware `Work` flow | AgentX Auto | Not Started | Commands, views, chat, and workflow guidance |
| 5 | Add evidence-capture and runtime-verification conventions | AgentX Auto | Not Started | Proof model and representative surfaces |
| 6 | Pilot on one or two complex work slices | AgentX Auto | Not Started | Measure usefulness and friction |
| 7 | Prune non-load-bearing scaffolding and document operating guidance | AgentX Auto | Not Started | Simplify based on observed lift |

## Detailed Workstreams

### Workstream A: Workflow and Template Contract

Deliverables:

- workflow-doc updates describing contract-driven `Work`
- contract template under `.github/templates/`
- optional guide for when evaluator involvement is required

Key questions:

- What is the minimum useful contract shape?
- Where should contract artifacts live?
- How do contract states map onto existing checkpoints without creating a second state machine?

Files likely touched:

- `docs/WORKFLOW.md`
- `.github/templates/EXEC-PLAN-TEMPLATE.md` or new contract template
- `docs/guides/*` if operator guidance is split out

### Workstream B: Runtime Harness State

Deliverables:

- file-backed contract state representation
- runner support for contract proposal, approval, and evaluation feedback loops
- explicit compaction/reset decision hooks

Key questions:

- Does contract state live inside harness thread state or as separate artifacts with references?
- How are evaluator findings attached to a slice?
- What triggers a clean-slate reset versus continuing in-place?

Files likely touched:

- `.agentx/agentic-runner.ps1`
- `.agentx/agentx-cli.ps1`
- `vscode-extension/src/utils/harnessState*.ts`
- `vscode-extension/src/utils/loopStateChecker*.ts`

### Workstream C: Evaluator and Evidence Loop

Deliverables:

- evaluator entry points inside `Work`
- stronger evidence summaries tied to contracts
- representative runtime-verification patterns

Key questions:

- Which existing roles own evaluation at each stage?
- What evidence is mandatory versus advisory?
- How are findings made actionable enough for the next iteration?

Files likely touched:

- `vscode-extension/src/review/*`
- `vscode-extension/src/eval/*`
- `docs/artifacts/reviews/*`

### Workstream D: Extension Surfaces

Deliverables:

- workflow guidance that understands contract readiness
- commands for creating/deepening contracts and kicking off evaluator loops
- sidebar visibility for active slice, findings, and evidence

Key questions:

- How much should be automated vs operator-invoked?
- What is the smallest useful UI surface to prove adoption?

Files likely touched:

- `vscode-extension/src/utils/workflowGuidance.ts`
- `vscode-extension/src/commands/*`
- `vscode-extension/src/views/*`
- `vscode-extension/src/chat/*`

### Workstream E: Simplification and Rollout

Deliverables:

- rollout scorecard and pilot guidance
- criteria for retaining or deleting harness components
- learning capture from pilot adoption

Key questions:

- Which harness pieces add measurable lift?
- Which pieces are now stale model-compensation scaffolds?

## Concrete Steps

- Review current workflow, harness-state, loop, review, and eval surfaces.
- Draft and agree on the contract artifact schema and location.
- Update workflow docs to define contract-first `Work` semantics.
- Add runtime support for contract lifecycle and evaluator feedback.
- Expose the new state in extension workflow guidance and commands.
- Pilot the contract loop on one complex implementation slice.
- Record findings and simplify where scaffolding is not load-bearing.

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| No formal issue exists yet for the implementation initiative | Traceability only | Use local-task plan/progress artifacts for planning, then create issue(s) before code implementation begins | Accepted |
| Current runtime enforcement is partial across docs, CLI, and extension | Medium | Roll out in waves with explicit pilot evidence and avoid claiming full enforcement until implemented | Active |

## Validation and Acceptance

- [ ] AgentX has a durable, documented contract artifact model for bounded work slices.
- [ ] `docs/WORKFLOW.md` defines contract-driven `Work` behavior without introducing a second lifecycle vocabulary.
- [ ] Runtime surfaces can track active contract state and evaluator findings durably.
- [ ] Extension guidance surfaces can explain current slice state, next move, and blockers.
- [ ] At least one pilot implementation demonstrates the contract/evaluator loop producing actionable findings and improved outcomes.
- [ ] Post-pilot review identifies at least one harness component to keep, simplify, or remove based on observed lift.

## Idempotence and Recovery

Planning and contract artifacts must be additive and rerunnable. A failed slice should be restartable from its contract, evidence, and latest findings without relying on chat history. Runtime state should prefer deterministic files over ephemeral in-memory coordination.

## Rollback Plan

If the contract-driven adoption proves too heavy, the rollback path is to preserve only the documentation and artifact schema while disabling runtime enforcement and extension entry points. Because the plan is staged, each wave should be independently removable without corrupting existing checkpoint or issue state.

## Artifacts and Notes

- Primary workflow source: `docs/WORKFLOW.md`
- Extension workflow state: `vscode-extension/src/utils/workflowGuidance.ts`
- Harness thread state: `vscode-extension/src/utils/harnessState.ts`
- Runtime execution surface: `.agentx/agentic-runner.ps1`
- Related concept source: Anthropic article `Harness design for long-running application development` published 2026-03-24

## Outcomes & Retrospective

- Initial planning complete.
- The design direction is to add a contract-driven implementation loop inside the existing checkpoint system, not replace the system.
- The adoption plan is intentionally staged so that each harness addition can be tested for actual value and removed if it stops being load-bearing.
- Next decision point: confirm whether to proceed with Wave 1 documentation/template work only, or immediately prepare a formal architecture artifact set plus implementation issue breakdown.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)