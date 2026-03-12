---
title: Harness Evaluation Adoption
status: Draft
owner: Engineer
last_updated: 2026-03-12
---

# Execution Plan: Harness Evaluation Adoption

## Purpose / Big Picture

Add an AgentX-native harness evaluation layer that can score session quality, explain failure causes, and measure how much of a run was directly observed versus inferred.

The goal is to improve AgentX's ability to validate its own agent workflows without replacing the current runtime. Success means AgentX can convert existing session, loop, harness, and validation artifacts into a consistent evaluation report that is useful for reviews, weekly health reporting, and future gating.

This execution plan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] Implementation planning started
- [x] Acceptance evidence recorded

## Surprises & Discoveries

- Observation: AgentX already has a usable first-pass harness state model, but the repo does not yet have a formal evaluation layer for scoring session quality.
  Evidence: `vscode-extension/src/utils/harnessState.ts` persists thread, turn, item, and evidence state, while `docs/QUALITY_SCORE.md` and `docs/tech-debt-tracker.md` still call out validation evidence and runtime harness maturity gaps.
- Observation: Existing repo quality reporting is stronger at structural checks than at session-quality attribution.
  Evidence: `scripts/check-harness-compliance.ps1` validates plan presence and evidence signals, and `.github/workflows/weekly-status.yml` reports plan health, but neither explains whether failures came from model behavior, harness design, or environment/tooling.

## Decision Log

- Decision: Keep harness evaluation additive and offline-first rather than embedding it directly into the critical execution path in phase 1.
  Options Considered: Hard gate in the live loop; post-run evaluation only; mixed mode with advisory scoring first.
  Chosen: Mixed mode with advisory scoring first.
  Rationale: AgentX needs signal quality and low false positives before harness evaluation becomes a blocking control.
  Date/Author: 2026-03-12 / GitHub Copilot
- Decision: Use deterministic checks plus lightweight attribution instead of relying on narrative review alone.
  Options Considered: Narrative-only reports; LLM-only judge; deterministic checks with optional attribution.
  Chosen: Deterministic checks with optional attribution.
  Rationale: This matches AgentX's existing bias toward mechanical rules, reproducibility, and CI-friendly validation.
  Date/Author: 2026-03-12 / GitHub Copilot

## Context and Orientation

Relevant current files and systems:

- `vscode-extension/src/utils/harnessState.ts`
- `vscode-extension/src/commands/loopCommand.ts`
- `scripts/check-harness-compliance.ps1`
- `.github/workflows/weekly-status.yml`
- `docs/QUALITY_SCORE.md`
- `docs/tech-debt-tracker.md`
- `docs/adr/ADR-Harness-Engineering.md`

Proposed new implementation areas:

- `vscode-extension/src/eval/` or `scripts/harness-eval/` for shared evaluation primitives
- `docs/reviews/` or `docs/testing/` for generated evaluation summaries if persisted in repo artifacts
- `.agentx/state/` for normalized session-evaluation inputs or outputs when local persistence is required

Constraints:

- Keep the first phase non-disruptive and non-blocking.
- Reuse existing repo-local artifacts before introducing new state sources.
- Do not refer to external repository names in docs, code, issues, or output artifacts.
- Preserve ASCII-only content and existing issue-first, plan-first conventions.

## Pre-Conditions

- [x] Dependencies reviewed at repo level
- [x] Required skills identified
- [x] Complexity assessed and this work merits a plan
- [ ] Issue created and classified if this moves from planning into implementation

## Plan of Work

Build harness evaluation in phases. First define a canonical AgentX session-evaluation model and a registry of deterministic checks. Next add passive evaluators that consume existing artifacts such as harness state, loop state, validation outputs, and session logs. Then add scoring and attribution so AgentX can report whether a failure was primarily caused by model behavior, harness design, policy gaps, or environment/tooling. Finally expose the results through weekly reporting and quality documents, keeping the first rollout advisory until signal quality is proven.

## Steps

| Step | Action | Owner | Status | Notes |
|------|--------|-------|--------|-------|
| 1 | Define canonical evaluation schema for runs, artifacts, checks, findings, and attribution | Engineer | Planned | Prefer TypeScript-first definitions with JSON-serializable output |
| 2 | Create deterministic check registry for loop discipline, policy coverage, context integrity, and evidence quality | Engineer | Planned | Align with existing golden principles and harness ADR |
| 3 | Add passive observers over existing AgentX artifacts and runtime outputs | Engineer | Planned | Start with harness state, loop state, validation outputs, and git/file evidence |
| 4 | Implement scoring and attribution summaries for model, harness, policy, and environment causes | Engineer | Planned | Advisory mode first |
| 5 | Integrate reporting into weekly status and targeted review artifacts | Engineer | Planned | Avoid merge-blocking until false-positive rate is acceptable |
| 6 | Decide whether to promote selected checks into CI or review gates | Engineer | Planned | Gate only mature, low-noise checks |

## Concrete Steps

- Draft a minimal `AgentXEvaluationRun` schema with typed findings, scores, and attribution buckets.
- Define a first-pass check set:
  - loop completion discipline
  - explicit checkpointing
  - evidence presence and evidence quality
  - plan linkage for complex work
  - observed vs inferred coverage
  - policy and tool-boundary adherence
- Prototype an evaluator that reads:
  - `.agentx/state/harness-state.json`
  - `.agentx/state/loop-state.json`
  - plan and progress artifacts under `docs/plans/` and `docs/progress/`
  - validation outputs already produced by scripts and workflows
- Produce a machine-readable report plus a compact markdown summary for reviewers.
- Run the evaluator in advisory mode before deciding any CI blocking policy.

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| No canonical session artifact format across all AgentX execution surfaces | Limits how much can be scored consistently in phase 1 | Start with the currently available local artifacts and expand coverage incrementally | Open |
| Current repo maturity docs lag some shipped harness implementation | May cause plan/report drift | Reconcile doc/runtime status as part of adoption follow-up | Open |

## Validation and Acceptance

- [ ] Adoption plan defines a phased rollout with clear target artifacts and owners
- [ ] Proposed check categories map to current AgentX runtime and documentation, not a replacement architecture
- [ ] Phase 1 stays advisory and avoids fragile blocking gates
- [ ] Plan contains no external repository names or references

Evidence will be recorded in `Artifacts and Notes` and in the matching progress log once implementation begins.

## Idempotence and Recovery

Phase 1 should be safe to rerun because it reads existing local artifacts and produces derived reports. If a report format proves noisy, the evaluator can be disabled without affecting the core loop or harness runtime. Each adopted check should be independently removable.

## Rollback Plan

If implementation introduces noise or maintenance burden, revert the harness evaluation module and reporting integration without modifying the underlying harness state or loop runtime. Keep any historical evaluation reports only if they remain useful as offline diagnostics.

## Artifacts and Notes

- [PASS] Adoption plan drafted on 2026-03-12 with AgentX-native scope and no external repository references.
- [PASS] Current harness baseline reviewed across plan gating, weekly reporting, and extension harness state before proposing rollout phases.
- [PASS] ADR created at `docs/adr/ADR-Harness-Evaluation-Adoption.md` on 2026-03-12.
- [PASS] Technical specification created at `docs/specs/SPEC-Harness-Evaluation-Adoption.md` on 2026-03-12.

## Outcomes & Retrospective

The immediate output is a concrete adoption plan plus matching ADR and technical specification for adding harness evaluation to AgentX without re-platforming the runtime. The next logical step is to translate these architecture artifacts into an implementation slice that defines the evaluation schema and first-pass check registry.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../.github/templates/EXEC-PLAN-TEMPLATE.md)