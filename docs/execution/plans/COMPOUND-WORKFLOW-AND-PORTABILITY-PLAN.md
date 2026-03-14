---
title: Compound Workflow And Portability Expansion
status: Draft
owner: Product Manager
last_updated: 2026-03-13
---

# Execution Plan: Compound Workflow And Portability Expansion

## Purpose / Big Picture

Strengthen AgentX's workflow system so planning, execution, review, compounding, bounded parallel delivery, skill packaging, and host portability feel like one coherent product surface instead of a set of adjacent capabilities. Success means operators can move from brainstorm to plan to work to review to compound capture with less manual stitching, while maintainers get a clear phased backlog for parallel execution, task bundles, skill authoring, and portable pack delivery.

## Progress

- [x] Existing workflow, knowledge, review, packaging, and portability surfaces reviewed
- [x] Planning gaps and overlap identified
- [x] Initiative scope narrowed into additive slices
- [x] Phased implementation backlog drafted
- [x] Phase-1 issue breakdown created
- [ ] Delivery sequencing approved
- [ ] First implementation slice started

## Surprises & Discoveries

- Observation: AgentX already has strong native footing for compound workflows through brainstorm guidance, learning capture, agent-native review, durable review findings, and the compound loop surface.
  Evidence: `docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md`, `vscode-extension/src/views/statusTreeProvider.ts`, and the `agentx.showCompoundLoop`, `agentx.createLearningCapture`, and `agentx.showAgentNativeReview` commands.
- Observation: The main gap is not concept absence; it is surface cohesion and sequencing between existing capabilities.
  Evidence: Workflow selection currently centers on broad workflow types in `vscode-extension/src/commands/workflow.ts`, while compound review/capture actions live separately in commands, chat prompts, guides, and sidebar actions.
- Observation: The repo already has the foundations for portability and packaging, but not yet a full host-surface generation roadmap.
  Evidence: `packs/`, `.github/schemas/plugin-manifest.schema.json`, install flows, and bundled extension documentation already support a packaging mindset.
- Observation: Parallelism exists in testing and pipeline guidance, but not yet as a first-class delivery orchestration model for product work.
  Evidence: testing and pipeline skills emphasize sharding and fan-out patterns, while the runtime workflow docs do not yet define bounded parallel task execution for engineering delivery.

## Decision Log

- Decision: Treat this initiative as an additive workflow-expansion program, not a replacement of the existing AgentX lifecycle.
  Options Considered: Replace current workflow types with a new workflow model; add a parallel side system; extend the current workflow and artifact contracts.
  Chosen: Extend the current workflow and artifact contracts.
  Rationale: The repo already has validated workflow, learning, review, and portability primitives. Extending those surfaces is lower risk and keeps current docs, commands, and tests legible.
  Date/Author: 2026-03-13 / GitHub Copilot
- Decision: Make surface cohesion the first delivery slice before deeper parallel execution or portability automation.
  Options Considered: Start with parallel task orchestration; start with pack export; start with workflow-surface cohesion.
  Chosen: Start with workflow-surface cohesion.
  Rationale: Better sequencing across brainstorm, plan, work, review, and compound capture improves operator value immediately and reduces rework for later orchestration layers.
  Date/Author: 2026-03-13 / GitHub Copilot
- Decision: Keep backlog tracking inside the normal AgentX issue hierarchy instead of creating a second initiative tracker.
  Options Considered: Separate initiative tracker; separate task-bundle tracker; standard AgentX epic/feature/story hierarchy.
  Chosen: Standard AgentX epic/feature/story hierarchy.
  Rationale: The repo already has durable review-finding promotion and standard workflow states. Reusing that system preserves traceability and avoids status drift.
  Date/Author: 2026-03-13 / GitHub Copilot

## Context and Orientation

Key files and surfaces:

- `docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md`
- `docs/WORKFLOW.md`
- `docs/artifacts/learnings/`
- `docs/artifacts/reviews/findings/`
- `vscode-extension/src/commands/workflow.ts`
- `vscode-extension/src/views/statusTreeProvider.ts`
- `vscode-extension/package.json`
- `.github/schemas/plugin-manifest.schema.json`
- `packs/`

Constraints:

- Keep all wording and artifacts repo-native.
- Preserve ASCII-only formatting.
- Build on current AgentX workflow states, not a second state machine.
- Prefer additive surfaces over breaking workflow rewrites.
- Keep portability implementation grounded in generated pack outputs and compatibility validation, not one-off hand-maintained host forks.

## Research Summary

### Sources Consulted

- Internal workflow contracts in `docs/WORKFLOW.md` and `AGENTS.md`
- Internal compound workflow guide in `docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md`
- Existing packaging, install, and portability scaffolding in `packs/`, `install.ps1`, `install.sh`, and `.github/schemas/plugin-manifest.schema.json`
- Existing extension workflow and status surfaces in `vscode-extension/src/commands/workflow.ts`, `vscode-extension/src/views/statusTreeProvider.ts`, and `vscode-extension/package.json`
- Repo memory and prior decisions in `memories/decisions.md`, `memories/conventions.md`, and `memories/pitfalls.md`

### Key Findings

1. AgentX already supports key lifecycle endpoints for brainstorm, review, compound capture, and durable follow-up work, but those capabilities are not yet presented as one guided operating loop.
2. Current workflow selection is broad and type-oriented; it does not yet provide explicit deepening stages for plan quality, work-mode transitions, or review readiness.
3. Parallel delivery patterns are proven in CI and test guidance but are not yet expressed as safe, bounded orchestration patterns for implementation work.
4. Packaging foundations exist through packs, schemas, bundled docs, and installers, which makes a generated portability strategy feasible without changing the product brand or core runtime model.
5. The highest-value roadmap is incremental: unify surfaces first, add bounded orchestration second, formalize task bundles and skill packaging third, then scale portability and governance last.

### Chosen Approach Rationale

The best path is a phased expansion that tightens the operating loop users already see, then adds bounded orchestration and packaging layers around it. This avoids restarting architecture, keeps existing review and knowledge-capture investments relevant, and creates clear checkpoints for validation.

### Rejected Alternatives

- Full workflow replacement: rejected because it would invalidate current docs, commands, and extension surfaces without first proving operator value.
- Separate tracker for orchestration tasks: rejected because AgentX already has a durable backlog model and issue lifecycle.
- Portability-first delivery: rejected because host export value is weaker if the underlying workflow surfaces and task decomposition model are still fragmented.

## Plan of Work

Deliver the initiative in six workstreams. First, make brainstorm, plan, work, review, and compound capture feel like one guided loop across chat, command, and sidebar surfaces. Second, add bounded orchestration patterns for parallel task execution with clear safety limits and result reconciliation. Third, formalize task bundles so work can be decomposed, resumed, promoted, and closed consistently. Fourth, strengthen skill packaging and authoring so reusable workflow intelligence is easier to route, validate, and evolve. Fifth, expand pack-based portability so AgentX can generate and validate consistent surfaces across supported hosts. Sixth, add governance and adoption checkpoints so the expansion stays measurable and additive.

## Implementation Principles

1. Keep the current AgentX lifecycle as the backbone: discover, plan, implement, review, validate, compound.
2. Prefer bounded orchestration over open-ended automation.
3. Reuse current artifact families: plans, progress logs, learnings, reviews, and review findings.
4. Generate portable surfaces from canonical repo data instead of hand-maintaining divergent host-specific copies.
5. Promote only validated reusable guidance into durable skills or learnings.

## Workstreams

### Workstream A - Workflow Surface Cohesion

Outcome: operators get an explicit guided loop from brainstorm through compound capture.

### Workstream B - Bounded Parallel Delivery

Outcome: AgentX can decompose eligible work into isolated sub-tasks, run them safely, and reconcile outputs through review.

### Workstream C - Task Bundle And Backlog Operations

Outcome: active work can be decomposed into explicit task bundles with clear ownership, status, promotion, and closure rules.

### Workstream D - Skill Packaging And Authoring

Outcome: skills become easier to scaffold, validate, group, and route by workflow phase and capability.

### Workstream E - Host Portability And Pack Generation

Outcome: AgentX can emit consistent host-facing surfaces from a canonical source without changing product identity.

### Workstream F - Governance, Metrics, And Rollout

Outcome: each slice has measurable adoption, quality, and rollback criteria before wider rollout.

## Backlog

### Epic A1 - Guided Workflow Loop

**Goal**: unify brainstorm, plan, work, review, and compound capture into a first-class operating path.

| ID | Type | Priority | Item | Description | Dependencies |
|----|------|----------|------|-------------|--------------|
| A1-F1 | Feature | p0 | Brainstorm-to-plan handoff | Define an explicit transition from brainstorm guidance into a plan-quality checkpoint with reusable learnings and open-question capture. | None |
| A1-F2 | Feature | p0 | Plan-to-work activation | Add a work-ready state that confirms plan sufficiency, dependencies, and review expectations before execution begins. | A1-F1 |
| A1-F3 | Feature | p1 | Review-to-compound closeout | Standardize review completion, learning capture, and durable finding promotion as one closeout flow. | A1-F2 |

**Stories**

- `A1-S1` `p0`: Add a repo-level workflow contract section that defines brainstorm, plan, work, review, and compound checkpoints with entry and exit criteria.
  Acceptance criteria:
  - [ ] Workflow docs define each checkpoint with observable triggers.
  - [ ] Chat, command, and sidebar language align to the same checkpoint names.
  - [ ] No second status model is introduced.
- `A1-S2` `p0`: Add command and chat entry points for plan deepening and review kickoff that reuse existing plan, learning, and review artifacts.
  Acceptance criteria:
  - [ ] Operators can trigger the checkpoints from at least two surfaces.
  - [ ] The entry points pull from existing issue, plan, and learning context.
  - [ ] The resulting guidance is durable enough to resume across sessions.
- `A1-S3` `p1`: Add sidebar affordances that show the next recommended workflow action based on current artifact state.
  Acceptance criteria:
  - [ ] Work and Status surfaces show the same next-step recommendation.
  - [ ] Recommendations change based on plan, review, and compound evidence.
  - [ ] The affordance remains advisory-first.

### Epic B1 - Bounded Parallel Delivery

**Goal**: introduce safe parallel execution for decomposable work without weakening review or traceability.

| ID | Type | Priority | Item | Description | Dependencies |
|----|------|----------|------|-------------|--------------|
| B1-F1 | Feature | p1 | Eligibility rules | Define what work can be decomposed into bounded parallel tasks and what work must stay sequential. | A1-F2 |
| B1-F2 | Feature | p1 | Isolated execution units | Create a task-unit contract for branch, worktree, or file-scope isolation with explicit merge and recovery guidance. | B1-F1 |
| B1-F3 | Feature | p1 | Result reconciliation | Add a review-first merge path that compares outputs, conflicts, and acceptance evidence before closure. | B1-F2 |

**Stories**

- `B1-S1` `p1`: Define the decomposition rubric for safe parallel work.
  Acceptance criteria:
  - [ ] Eligibility is limited to independent or loosely coupled tasks.
  - [ ] Ineligible work categories are documented.
  - [ ] Review requirements tighten when parallel execution is used.
- `B1-S2` `p1`: Create a task-unit artifact contract that records scope, owner, status, branch/worktree choice, and merge rules.
  Acceptance criteria:
  - [ ] Each unit has a durable artifact or state record.
  - [ ] Recovery steps exist if one unit fails.
  - [ ] The parent plan can summarize unit health without opening each unit.
- `B1-S3` `p2`: Add a reconciliation checklist that must pass before parallel outputs are considered complete.
  Acceptance criteria:
  - [ ] Conflicts, shared-file overlap, and acceptance evidence are reviewed.
  - [ ] A single owner approves the reconciled result.
  - [ ] Follow-up findings can be promoted through the normal backlog.

### Epic C1 - Task Bundle And Backlog Operations

**Goal**: make decomposition and follow-up work legible through explicit task bundles instead of ad-hoc notes.

| ID | Type | Priority | Item | Description | Dependencies |
|----|------|----------|------|-------------|--------------|
| C1-F1 | Feature | p1 | Task bundle format | Introduce a file-backed bundle format for decomposed work, pending actions, and operator notes. | A1-F2 |
| C1-F2 | Feature | p1 | Promotion and closure rules | Define how bundle items promote into normal issues and how closed items are archived. | C1-F1 |
| C1-F3 | Feature | p2 | Bundle UX surfaces | Expose bundle creation, review, and cleanup through command/chat/sidebar surfaces. | C1-F2 |

**Stories**

- `C1-S1` `p1`: Define the minimum metadata for a task bundle.
  Acceptance criteria:
  - [ ] Bundle records include parent context, priority, state, evidence links, and owner.
  - [ ] Bundle states map to AgentX workflow states or clearly documented substates.
  - [ ] The format is repo-local and ASCII-safe.
- `C1-S2` `p1`: Define promotion paths from bundle items to features, stories, or review findings.
  Acceptance criteria:
  - [ ] Promotion rules avoid duplicate backlog entries.
  - [ ] Closed work can remain searchable after promotion.
  - [ ] The standard issue hierarchy remains the source of truth.
- `C1-S3` `p2`: Add operator commands for creating, listing, resolving, and promoting task bundles.
  Acceptance criteria:
  - [ ] Operators can manage bundles without manual file editing.
  - [ ] Context-sensitive actions resolve the active issue or plan when available.
  - [ ] The flow works in both extension and CLI contexts.

### Epic D1 - Skill Packaging And Authoring

**Goal**: make reusable workflow intelligence easier to author, validate, group, and route.

| ID | Type | Priority | Item | Description | Dependencies |
|----|------|----------|------|-------------|--------------|
| D1-F1 | Feature | p1 | Workflow-phase skill metadata | Extend skill routing so skills can declare stronger workflow-phase relevance, portability markers, and validation maturity. | None |
| D1-F2 | Feature | p1 | Skill scaffolding flow | Add a guided scaffolding path for new skills, collections, and reference bundles. | D1-F1 |
| D1-F3 | Feature | p2 | Skill bundle reviews | Introduce a review scorecard for new or expanded skills before adoption. | D1-F2 |

**Stories**

- `D1-S1` `p1`: Extend skill metadata to support workflow-phase and host-surface compatibility hints.
  Acceptance criteria:
  - [ ] Metadata remains backward compatible.
  - [ ] The new fields improve routing without bloating all skills.
  - [ ] Validation tooling understands the new fields.
- `D1-S2` `p1`: Create a guided scaffolding flow for skill packs and reference-heavy skills.
  Acceptance criteria:
  - [ ] The scaffold creates the canonical folder structure.
  - [ ] Prompt, reference, and asset slots are generated intentionally.
  - [ ] Token-budget expectations are built into the flow.
- `D1-S3` `p2`: Add a reusable review scorecard for skill adoption quality.
  Acceptance criteria:
  - [ ] The scorecard checks clarity, routing value, evidence, and maintenance cost.
  - [ ] Review outcomes are recorded in a durable artifact.
  - [ ] Low-quality skills can be rejected or sent back for iteration.

### Epic E1 - Host Portability And Pack Generation

**Goal**: generate consistent host-facing packages from canonical AgentX data and docs.

| ID | Type | Priority | Item | Description | Dependencies |
|----|------|----------|------|-------------|--------------|
| E1-F1 | Feature | p1 | Canonical portability contract | Define which repo assets generate host-facing commands, instructions, and bundled docs. | D1-F1 |
| E1-F2 | Feature | p1 | Pack generation pipeline | Add a pack-generation path that emits validated host packages from the canonical contract. | E1-F1 |
| E1-F3 | Feature | p2 | Compatibility validation matrix | Add automated checks that generated packs remain in sync with canonical docs and runtime assumptions. | E1-F2 |

**Stories**

- `E1-S1` `p1`: Define the canonical portability manifest and generation boundaries.
  Acceptance criteria:
  - [ ] The contract names the source-of-truth files for commands, docs, and instructions.
  - [ ] Product identity stays stable across generated surfaces.
  - [ ] Host-specific deltas are explicit and minimal.
- `E1-S2` `p1`: Implement a generated pack workflow that emits installable compatibility outputs.
  Acceptance criteria:
  - [ ] Generated packs are reproducible.
  - [ ] The workflow fails on missing required assets.
  - [ ] Generated docs use valid local links in bundled outputs.
- `E1-S3` `p2`: Add validation that compares canonical content to generated pack outputs.
  Acceptance criteria:
  - [ ] Drift is detected automatically.
  - [ ] Validation can run locally and in CI.
  - [ ] Failures point to the canonical source that needs repair.

### Epic F1 - Governance, Metrics, And Rollout

**Goal**: ship the expansion in controlled slices with explicit quality and adoption gates.

| ID | Type | Priority | Item | Description | Dependencies |
|----|------|----------|------|-------------|--------------|
| F1-F1 | Feature | p0 | Rollout scorecard | Define adoption, quality, and rollback metrics for each workstream. | None |
| F1-F2 | Feature | p1 | Pilot slices | Stage the rollout so workflow-surface changes prove value before orchestration and portability scale-up. | F1-F1 |
| F1-F3 | Feature | p1 | Documentation and operator enablement | Add update guides and release notes for each major slice. | F1-F2 |

**Stories**

- `F1-S1` `p0`: Create a rollout scorecard covering usage, task completion quality, review findings, and operator friction.
  Acceptance criteria:
  - [ ] Every workstream has success and rollback thresholds.
  - [ ] Metrics can be captured with existing or planned artifacts.
  - [ ] The scorecard is referenced in closeout reviews.
- `F1-S2` `p1`: Define the pilot order and exit criteria.
  Acceptance criteria:
  - [ ] Workflow cohesion ships before bounded parallel delivery.
  - [ ] Parallel delivery ships before broad portability automation.
  - [ ] Each pilot slice has a documented recovery path.
- `F1-S3` `p1`: Create an operator enablement checklist for new workflow surfaces.
  Acceptance criteria:
  - [ ] Commands, chat prompts, and sidebars are documented together.
  - [ ] The checklist is short enough for release use.
  - [ ] The rollout does not rely on tribal knowledge.

## Recommended Delivery Sequence

1. Epic A1 - Guided Workflow Loop
2. Epic F1 - Governance, Metrics, And Rollout
3. Epic C1 - Task Bundle And Backlog Operations
4. Epic B1 - Bounded Parallel Delivery
5. Epic D1 - Skill Packaging And Authoring
6. Epic E1 - Host Portability And Pack Generation

## Second-Wave Backlog Ready For Tracking

The second-wave backlog should open immediately after phase-1 rollout controls are in place. The recommended tracking shape is:

- Feature: Task Bundle And Backlog Operations
  Stories:
  - Define task bundle minimum metadata
  - Define promotion paths from bundle items
  - Add operator commands for task bundles
- Feature: Bounded Parallel Delivery
  Stories:
  - Define bounded parallel eligibility rubric
  - Define isolated task-unit contract
  - Define reconciliation checklist for parallel outputs

## Milestones

| Milestone | Scope | Exit Signal |
|-----------|-------|-------------|
| M1 | Workflow cohesion | Guided loop contracts and entry points exist across docs plus at least two operator surfaces |
| M2 | Task bundles | File-backed decomposition and promotion model is documented and pilotable |
| M3 | Parallel delivery pilot | Eligibility, task units, and reconciliation flow validated on limited slices |
| M4 | Skill packaging uplift | Metadata, scaffolding, and review scorecard are available |
| M5 | Portability pipeline | Generated packs and compatibility validation run from canonical repo assets |

## Risks And Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Workflow sprawl returns under new names | Users see more commands but not more coherence | Ship surface cohesion first and require a named checkpoint contract |
| Parallel delivery creates review debt | Faster execution but weaker correctness | Gate decomposition behind eligibility rules and reconciliation review |
| Task bundles become a second backlog | Status drift and maintenance burden | Require promotion into normal AgentX issues for durable tracked work |
| Portability creates host drift | Docs and commands diverge across hosts | Generate from canonical repo data and validate in CI |
| Skill metadata grows too fast | Routing becomes noisy and hard to maintain | Add only fields with proven routing or validation value |

## Validation and Acceptance

- [x] The initiative is decomposed into phased epics, features, and stories
- [x] Each epic has a clear product outcome and dependency story
- [x] The plan builds on existing AgentX contracts and artifact families
- [x] No outside references or copied source language are required to use the plan
- [ ] The backlog is converted into normal AgentX issue hierarchy
- [ ] The first slice is approved for implementation

## Idempotence and Recovery

This plan is safe to refine incrementally because each workstream is additive and the recommended sequence isolates riskier changes behind earlier contract work. If a later slice underperforms, the previous workflow, learning, review, and packaging surfaces remain valid because none of the proposed milestones require removing the current system first.

## Artifacts and Notes

- Internal workflow review covered `docs/WORKFLOW.md`, `docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md`, `vscode-extension/src/commands/workflow.ts`, `vscode-extension/src/views/statusTreeProvider.ts`, `vscode-extension/package.json`, and packaging assets under `packs/`.
- Existing repo memory already supports a repo-native direction for compound loop strengthening, additive harness evaluation, and pack-based portability rather than direct structural copying.
- GitHub issue hierarchy created on 2026-03-13:
  - Epic `#215` `[Epic] Compound Workflow And Portability Expansion`
  - Feature `#214` `[Feature] Guided Workflow Loop`
  - Feature `#216` `[Feature] Governance, Metrics, And Rollout`
  - Stories `#217`, `#218`, `#219`, `#220`, `#221`, and `#222`
- Durable product artifact created at `docs/artifacts/prd/PRD-215.md`.

## Outcomes & Retrospective

The planning slice is complete. AgentX now has a repo-native implementation backlog for workflow cohesion, bounded parallel delivery, task bundles, skill packaging, portability, and rollout governance, plus a tracked phase-1 issue hierarchy and durable PRD. The next product action is to start implementation from Feature `#214` and Feature `#216` in that order.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)