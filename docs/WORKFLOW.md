# AI Agent Workflow Reference

> **Complete workflow, routing, handoff, and status management for AgentX agents.**
> This file is the deep reference for how work flows through the system.
> For a quick map of all resources, see [AGENTS.md](../AGENTS.md).

---

## Critical Workflow

### Before ANY Work

1. **Research** codebase (`semantic_search`, `grep_search`, `file_search`)
2. **Classify** request (Epic/Feature/Story/Bug/Spike/Docs)
3. **Create Issue** with type label
4. **Assess Complexity** (simple vs. complex / multi-phase)
5. **Create Execution Plan** for complex work before implementation or long-running loops
6. **Execute** role-specific work
7. **Update Status** in GitHub Projects V2 (or local file in Local Mode)

### Issue-First Flow

Every piece of work -- bug fix, feature, docs update -- **SHOULD** start with an issue.

**Why issue-first?** Agents rely on issues for routing, status tracking, and handoffs. The ready queue sorts by priority. Commits reference issues for traceability. Without an issue, nothing can be routed or reviewed.

**Issue enforcement by mode:**
- **GitHub Mode**: Issue references in commits are **required** by default (teams need traceability)
- **Local Mode**: Issue references are **optional** by default (solo developers can commit freely)
- To toggle enforcement: `.agentx/agentx.ps1 config set enforceIssues true` (or `false`)

**GitHub Mode:**
```bash
gh issue create --title "[Story] Add /health endpoint" --label "type:story"  # Creates #42
.\.agentx\agentx.ps1 ready                        # Pick from ready queue
# Work... then commit:
git commit -m "feat: add health endpoint (#42)"
gh issue close 42 --reason completed
```

**Local Mode:**
```powershell
# Issues are optional in local mode - you can commit without issue references
git commit -m "feat: add user login"

# Or use full issue workflow if preferred:
.\.agentx\local-issue-manager.ps1 -Action create -Title "[Bug] Fix timeout" -Labels "type:bug"
.\.agentx\local-issue-manager.ps1 -Action update -IssueNumber 1 -Status "In Progress"
git commit -m "fix: resolve login timeout (#1)"
.\.agentx\local-issue-manager.ps1 -Action close -IssueNumber 1

# Enable issue enforcement in local mode:
.\.agentx\agentx.ps1 config set enforceIssues true
```

**Emergency bypass (GitHub mode)**: Add `[skip-issue]` to the commit message for hotfixes. Create a retroactive issue afterward.

> **Status Tracking**: Use GitHub Projects V2 **Status** field (GitHub mode) or local JSON status (Local mode).
> See [GUIDE.md](GUIDE.md#local-mode-no-github) for local mode details.

### Execution Plans For Complex Work

For simple work, the standard issue-first flow is sufficient. For complex work, the issue-first flow is necessary but not sufficient.

**Complex work** includes any task with one or more of the following characteristics:

- Multi-phase implementation or investigation
- Multiple subsystems, agents, or deliverables touched in one effort
- Significant ambiguity or meaningful design decisions to record
- Expected duration beyond a short interactive session
- Work that must be resumable by a different agent or after context loss

When a task is complex, agents **MUST** create and maintain an execution plan using [.github/templates/EXEC-PLAN-TEMPLATE.md](../.github/templates/EXEC-PLAN-TEMPLATE.md) before starting implementation.

**Current enforcement state:** This is a workflow policy today. Mechanical enforcement is partial until the quality gates and automation are extended to check plan presence, freshness, and evidence links.

**Execution plan requirements:**

- Plans are living documents, not one-time approvals
- Plans must record progress, decisions, blockers, validation steps, and recovery guidance
- Plans must be detailed enough that a new agent can resume from the plan and current repo state alone
- Plans must be updated at meaningful stopping points, not only at the end of work

**Why this exists:** Harness-oriented workflows depend on durable, repo-local state. If a complex task cannot be resumed from artifacts in the repository, it is not yet legible enough for reliable agent execution.

---

## Architecture

### Hub-and-Spoke Pattern

AgentX uses a **Hub-and-Spoke architecture** for agent coordination:

```
                        Agent X (Hub)
                             |
              +--------------+--------------+
              |              |              |
         PM Agent     (PRD complete)        |
              |              |              |
    +---------+---------+    |              |
    |         |         |    |              |
 Architect  Data     UX     |              |
  Agent   Scientist Agent   |              |
    |         |         |    |              |
    +---------+---------+    |              |
              |              |              |
         Engineer Agent      |              |
              |              |              |
         Reviewer Agent      |              |
              |              |              |
    +---------+---------+    |              |
    |                   |    |              |
  DevOps Agent    Tester Agent              |
    |                   |    |              |
    +---------+---------+    |              |
              |              |              |
    Engineer (bug fixes) <---+     Consulting Research
                                  (standalone)
```

**Standalone Agents** (outside SDLC pipeline):

```
  Agile Coach    Consulting Research    Power BI Analyst
     |               |                  |
  (Stories)       (Research)         (Reports)
```

**Invisible Sub-Agents** (spawned by parent agents):

```
  Agent X -------> GitHub Ops (GitHub backlog management)
  Agent X -------> ADO Ops (ADO backlog management)
  PM -------------> GitHub Ops (child issue creation)
  PM -------------> ADO Ops (work item creation)
  Reviewer ------> GitHub Ops (issue status/labels)
  Reviewer ------> ADO Ops (work item status)
  Reviewer ------> Functional Reviewer (branch diff analysis)
  Reviewer ------> Eval Specialist (AI model quality review)
  Tester --------> GitHub Ops (defect issue creation)
  Tester --------> ADO Ops (defect work item creation)
  Data Scientist -> Prompt Engineer (prompt lifecycle)
  Data Scientist -> Eval Specialist (evaluation pipelines)
  Data Scientist -> Ops Monitor (AgentOps + drift)
  Data Scientist -> RAG Specialist (retrieval pipelines)
  Engineer -------> Prompt Engineer (needs:ai prompt work)
  Engineer -------> RAG Specialist (needs:ai RAG implementation)
  DevOps ---------> Ops Monitor (deployment monitoring)
```

**Key Principles:**

1. **Centralized Coordination** - Agent X is the top-level autonomous executor. It SHOULD complete work in one session whenever feasible and use specialist stages as internal workflow phases. Manual agent switching is a fallback for isolation or platform limitations.
2. **Strict Role Separation** - Each agent produces one deliverable type (PRD, ADR, Code, Review)
3. **Universal Tool Access** - All agents have access to all tools for maximum flexibility
4. **Status-Driven** - GitHub Projects V2 Status field is the source of truth
5. **Pre-Handoff Validation** - Artifacts validated before status transitions
6. **Post-Review Validation** - DevOps and Tester validate in parallel after Reviewer approves
7. **Bug-Fix Feedback Loop** - Tester defects route back to Engineer for resolution
8. **Two-Layer Architecture** - Skills (Markdown) encode domain knowledge; MCP servers handle tool execution. Skills are the orchestration layer; MCP is the plumbing. Every skill works standalone without MCP connections.

### Routing Logic

Agent X routes issues based on:
- **Issue type** (Epic, Feature, Story, Bug, Spike)
- **Status** (Backlog, In Progress, In Review, Ready, Done)
- **Labels** (needs:ux, needs:changes, etc.)
- **Prerequisites** (PRD exists, UX complete, Spec ready)

**Routing rules:**
```
Epic + Backlog -> Product Manager
Ready + needs:ux -> UX Designer (parallel with Architect, Data Scientist)
Ready + (no architecture) -> Architect (parallel with UX, Data Scientist)
Ready + type:data-science -> Data Scientist (parallel with Architect, UX)
Ready + (has architecture) -> Engineer
needs:iteration -> Engineer (extended iterative-loop workflow, max 20)
In Review -> Reviewer
Reviewer approved -> DevOps Engineer + Tester (parallel post-review validation)
Tester defects found -> Engineer (bug-fix feedback loop)
Bug + Backlog -> Engineer (skip PM/Architect)
Spike + Backlog -> Architect
type:devops + Backlog -> DevOps Engineer (skip PM/Architect for infrastructure work)
type:data-science + Backlog -> Data Scientist (skip PM/Architect for ML/AI work)
type:testing + Backlog -> Tester (skip PM/Architect for testing/certification work)
type:powerbi + Backlog -> Power BI Analyst (skip PM/Architect for report/dashboard work)
In Review + needs:testing -> Tester (pre-release certification)
```

**Autonomous Mode**: For simple tasks (bugs, docs, stories <=3 files), Agent X can automatically route to Engineer, skipping manual coordination. See [Agent X](../.github/agents/agent-x.agent.md) (mode: adaptive).

**Universal Iterative Refinement**: ALL workflows include `iterate = true` on the Engineer's implementation step by default. The Reviewer ALWAYS verifies loop completion before approval. The `needs:iteration` label is reserved for **extended** iteration (max 20 iterations). See [Iterative Loop Skill](../.github/skills/development/iterative-loop/SKILL.md).

### Validation

**Pre-handoff validation** ensures quality before status transitions:

```bash
# Validate before handoff
./.github/scripts/validate-handoff.sh <issue_number> <role>

# Example
./.github/scripts/validate-handoff.sh 100 pm
```

**Validation checks:**
- PM: PRD exists, child issues created, required sections present
- UX: Wireframes + user flows + **HTML/CSS prototypes (MANDATORY)** complete, accessibility considered
- Architect: ADR + Tech Spec exist, NO CODE EXAMPLES compliance
- Data Scientist: ML pipeline design, evaluation plan, model card present
- Engineer: Code committed, tests 80% coverage, docs updated
- Reviewer: Review document complete, approval decision present
- DevOps: CI/CD pipelines validated, deployment docs present
- Tester: Test suites pass, certification report complete
- Power BI Analyst: Semantic model validated, DAX measures tested, report spec documented

**Harness-oriented validation additions:**
- Complex tasks: execution plan exists and is current
- Multi-phase work: progress log reflects actual current state
- Validation-heavy work: evidence artifacts or summaries are linked from the plan or progress log
- Architecture/runtime changes: docs and implementation claims do not materially drift

These checks are the target validation model. Where automation is not yet present, reviewers and role agents are expected to enforce them manually.

---

## Orchestration Modes

| Mode | How It Works | Platform |
|------|-------------|----------|
| **Mode 1: Agent X Autonomous** | Agent X classifies work and executes it end to end in one session, applying PM -> [Architect, UX, Data Scientist] -> Engineer -> Reviewer -> [DevOps, Tester] as internal phases when needed | VS Code, Claude Code |
| **Mode 2: Human-Orchestrated** | User picks agent from Copilot agent picker; `handoffs:` frontmatter renders "Hand off to X" buttons | VS Code |
| **CLI Standalone** | `agentx.ps1 run <agent> <task>` runs agent via GitHub Models API; no sub-agent chaining | CLI |

### Agent-to-Agent Communication

Agent X SHOULD keep work in one session by applying specialist constraints internally.
When strict role isolation or platform behavior requires it, agents MAY still communicate
through the user and ask for a manual switch to the relevant specialist.

### Self-Review Loop

Body text in every agent instructs: "Before handoff, re-check your work against the done criteria."
The agent evaluates with structured findings ([HIGH], [MEDIUM], [LOW]) and addresses HIGH/MEDIUM
findings before completing.

For complex tasks, self-review also checks that the execution plan and progress artifacts remain accurate. A technically correct change with stale plan state is not complete.

---

## Handoff Flow

```
Discover/Plan -> [Architect, Data Scientist, UX] -> Engineer -> Reviewer -> [DevOps, Tester] -> Engineer (bug fixes if needed)
```

**Design Phase**: Architect, Data Scientist, and UX inputs are applied before implementation when complexity requires them.
**Parallel Validation Phase**: DevOps Engineer and Tester validate in parallel after Reviewer approves.
**Bug-Fix Feedback Loop**: Tester defects route back to Engineer for resolution before closing.

> **Note**: Consulting Research, Power BI Analyst, and Agile Coach operate **standalone** (not part of the core SDLC pipeline). GitHub Ops, ADO Ops, Functional Reviewer, Prompt Engineer, Eval Specialist, Ops Monitor, and RAG Specialist are invisible sub-agents spawned by their parent agents.

### Backlog-Based Handoffs

Agents query the backlog for the next priority item instead of receiving explicit issue numbers.

| Agent | Picks Up |
|-------|----------|
| **UX Designer** | Status=`Ready` + `needs:ux`, sorted by priority |
| **Architect** | Status=`Ready` + PRD complete, sorted by priority |
| **Engineer** | Status=`Ready` + ADR/Spec complete, sorted by priority |
| **Reviewer** | Status=`In Review`, sorted by priority |
| **DevOps** | `type:devops` + Status=`Ready`, sorted by priority |
| **Data Scientist** | `type:data-science` + Status=`Ready`, sorted by priority |
| **Tester** | `type:testing` + Status=`Ready` or `In Review` + `needs:testing`, sorted by priority |
| **Power BI Analyst** | `type:powerbi` + Status=`Ready`, sorted by priority |

**Priority Order**: `priority:p0` > `priority:p1` > `priority:p2` > `priority:p3` > (no label)

If no matching issues found, agent reports "No [role] work pending."

### Context Management

Clear context before implementation phase to prevent design assumptions from leaking into code.

| Transition | Clear? | Reason |
|------------|--------|--------|
| PM -> UX/Architect/Data Scientist | No | Needs PRD context |
| UX/Architect/Data Scientist -> Engineer | **Yes** | Engineer follows spec only |
| Engineer -> Reviewer | No | Reviewer needs full context |
| Reviewer -> DevOps/Tester | No | Needs review context |
| Tester -> Engineer (bug fixes) | No | Needs defect details |
| Reviewer -> Engineer (rework) | No | Needs review feedback |

### Status Transitions

| Phase | Status Transition | Meaning |
|-------|-------------------|---------|
| PM completes PRD | -> `Ready` | Ready for design/architecture |
| UX completes designs | -> `Ready` | Ready for implementation |
| Architect completes spec | -> `Ready` | Ready for implementation |
| Data Scientist completes ML design | -> `Ready` | Ready for implementation |
| Engineer starts work | -> `In Progress` | Active development |
| Engineer completes code | -> `In Review` | Ready for code review |
| Reviewer approves | -> `Validating` | Ready for post-review validation |
| DevOps + Tester validate | -> `Done` + Close | Work complete (or back to Engineer for bug fixes) |

### Status Values

| Status | Meaning |
|--------|--------|
| `Backlog` | Issue created, not started |
| `In Progress` | Active work by Engineer |
| `In Review` | Code review phase |
| `Validating` | Post-review validation by DevOps + Tester |
| `Ready` | Design/spec done, awaiting next phase |
| `Done` | Completed and closed |

---

## Labels

**Type Labels**: `type:epic`, `type:feature`, `type:story`, `type:bug`, `type:spike`, `type:docs`, `type:data-science`, `type:testing`, `type:powerbi`

**Priority Labels**: `priority:p0`, `priority:p1`, `priority:p2`, `priority:p3`

**Workflow Labels**: `needs:ux`, `needs:help`, `needs:changes`, `needs:iteration` (extended loop, max 20), `needs:testing` (pre-release certification)

---

**See Also**: [AGENTS.md](../AGENTS.md) (map) | [Skills.md](../Skills.md) (production code standards) 
