# AI Agent Guidelines

> **AUTHORITATIVE SOURCE**: Single source of truth for all agent behavior and workflows.

## 📖 Table of Contents

### Core Workflows (Critical - Read First)
1. [⚠️ CRITICAL WORKFLOW](#️-critical-workflow) - Research → Classify → Issue → Execute
2. [📋 Classification](#-classification) - Request type categorization
3. [🔄 Orchestration](#-orchestration--handoffs) - Sequential agent coordination

### Implementation
4. [🎯 Handoff Protocol](#-handoff-protocol) - 4 mandatory steps
5. [🔧 Tools](#-tools--infrastructure) - MCP Server, GitHub CLI
6. [🤖 The Orchestrator](#-the-orchestrator) - Central coordinator

### Reference
7. [🚨 Error Handling](#-error-handling) - Recovery strategies
8. [🛡️ Security](#️-operational-controls) - Execution modes & limits
9. [📚 Quick Reference](#-quick-reference) - Commands & decision trees

---

# ⚠️ CRITICAL WORKFLOW

## Mandatory: Research → Classify → Create Issue → Execute

**Before ANY work:**
1. **Research** codebase/requirements (`semantic_search`, `grep_search`, `file_search`, `runSubagent`)
2. **Classify** request type (Epic/Feature/Story/Bug/Spike/Docs)
3. **Create Issue** with proper type label
4. **Claim Issue** (Status → 'In Progress')
5. **Execute** role-specific work
6. **Handoff** via orchestration labels

**Issue Commands (MCP):**
```json
// Create
{"tool": "issue_write", "args": {"method": "create", "title": "[Type] Description", "labels": ["type:task"]}}

// Claim: Status is automatically updated by orchestrator workflows
// - Epic/Feature/Story → 'Ready' after PM/Architect completes
// - Story/Feature → 'In Progress' when Engineer starts
// - Story/Feature → 'In Review' when Engineer completes
// - Story/Feature → 'Done' when Reviewer approves

// Close
{"tool": "update_issue", "args": {"issue_number": ID, "state": "closed"}}
```

---

## 📋 Classification

| Type | Role | Keywords | Deliverable |
|------|------|----------|-------------|
| `type:epic` | 📋 PM | "platform", "system", "build me..." | PRD + Backlog |
| `type:feature` | 🏗️ Architect | "add X feature", "implement Y" | ADR + Tech Spec |
| `type:story` | 🔧 Engineer | "button", "field", "validation" | Code + Tests |
| `type:bug` | 🔧 Engineer | "broken", "fix", "error" | Bug fix + Tests |
| `type:spike` | 🏗️ Architect | "research", "evaluate", "compare" | Research doc |
| `type:docs` | 🔧 Engineer | "document", "readme", "update docs" | Documentation |

**Decision Tree:**
- **Q1:** Broken? → `type:bug` (Engineer)
- **Q2:** Research/comparison? → `type:spike` (Architect)
- **Q3:** Docs only? → `type:docs` (Engineer)
- **Q4:** Large/vague? → `type:epic` (PM)
- **Q5:** Single capability? → `type:feature` (Architect)
- **Q6:** Else → `type:story` (Engineer)
- **+** Has UI? Add `needs:ux` label

---

## 🔄 Orchestration & Handoffs

**Sequential Flow:** PM → UX Designer → Architect → Engineer → Reviewer

### Handoff Signals

| From → To | Trigger Condition | Signal Label |
|-----------|------------------|--------------|
| PM → UX | Complete backlog created | `orch:pm-done` |
| UX → Architect | All UX designs complete | `orch:ux-done` |
| Architect → Engineer | All Tech Specs complete | `orch:architect-done` |
| Engineer → Reviewer | Implementation + tests done | `orch:engineer-done` |
| Reviewer → Close | Code review passed | Close issue |

### Agent Roles (Brief)

**📋 Product Manager:**
1. Claim Epic (Status: In Progress)
2. Create PRD at `docs/prd/PRD-{issue}.md`
3. Create Feature + Story issues (Status: Backlog)
4. Self-review PRD completeness
5. Add `orch:pm-done` → **Child stories auto-move to Ready**

**🎨 UX Designer:**
1. Wait for `orch:pm-done`, claim Epic
2. Create wireframes + prototypes at `docs/ux/`
3. Self-review accessibility (WCAG 2.1 AA)
4. Commit UX designs, add `orch:ux-done`

**🏗️ Architect:**
1. Wait for `orch:ux-done`, claim Epic
2. Create ADR + Specs at `docs/adr/`, `docs/specs/`
3. Self-review feasibility
4. Commit docs, add `orch:architect-done` → **Ready stories available for Engineer**

**🔧 Engineer:**
1. Wait for `orch:architect-done`, claim Story
2. **Status auto-updates to In Progress**
3. Implement code + tests (≥80% coverage)
4. Self-review quality + security
5. Commit: `"type: description (#issue)"`, add `orch:engineer-done`
6. **Status auto-updates to In Review**

**✅ Reviewer:**
1. Review code, tests, security
2. Create `docs/reviews/REVIEW-{issue}.md`
3. If approved: Close issue → **Status auto-updates to Done**
4. If changes needed: Status → In Progress, add `needs:changes`

---

## 🎯 Handoff Protocol

### 4 Mandatory Steps When Completing Work:

**1. Document Your Work**
- **PM**: PRD at `docs/prd/PRD-{issue}.md`
- **Architect**: ADR + Spec at `docs/adr/`, `docs/specs/`
- **UX**: Design at `docs/ux/UX-{issue}.md`
- **Engineer**: Code + tests + docs
- **Reviewer**: Review at `docs/reviews/REVIEW-{issue}.md`
- Commit: `"type: description (#issue)"`

**2. Update Issue State**
```json
// Status is automatically updated by orchestrator workflows:
// - PM completes → Child stories move to 'Ready'
// - Engineer starts → Status moves to 'In Progress'
// - Engineer completes → Status moves to 'In Review'
// - Reviewer approves → Status moves to 'Done'

// Add orchestration label (keeps existing labels)
{"tool": "update_issue", "args": {"issue_number": ID, "labels": ["type:X", "orch:ROLE-done"]}}
```

**3. Post Summary Comment**
```json
{"tool": "add_issue_comment", "args": {
  "issue_number": ID,
  "body": "## ✅ Completed: [Role]\n\n**Deliverables:**\n- [artifacts]\n\n**Next:**\n- [next steps]"
}}
```

**4. Trigger Next Agent**
```json
// Orchestrator auto-triggers on label change, or manual trigger:
{"tool": "run_workflow", "args": {
  "workflow_id": "agent-orchestrator.yml",
  "ref": "master",
  "inputs": {"issue_number": "ID"}
}}
```

---

## 🔧 Tools & Infrastructure

### MCP Server (Primary)

**Configuration:** `.vscode/mcp.json` → Remote: `https://api.githubcopilot.com/mcp/`

#### Issue Management

| Tool | Purpose |
|------|---------|
| `issue_write` | Create/update issues |
| `update_issue` | Update labels/state |
| `add_issue_comment` | Add comments |
| `issue_read` | Get issue details |

#### Workflow Automation

| Tool | Purpose |
|------|---------|
| `run_workflow` | Trigger `workflow_dispatch` |
| `list_workflow_runs` | Check status |
| `get_workflow_run` | Get run details |
| `cancel_workflow_run` | Cancel workflow |

### GitHub CLI (Fallback)

```bash
gh issue create --title "[Type] Description" --label "type:story"
gh workflow run <file.yml> -f issue_number=48
gh issue close <ID>
```

### Status Tracking

**GitHub Projects v2 Status field (automatically updated by workflows):**
- 📝 **Backlog** - Waiting to be claimed (new issues)
- 🏗️ **Ready** - Design done, awaiting Engineer (set by PM/Architect)
- 🚀 **In Progress** - Active development (set when Engineer starts)
- 👀 **In Review** - Code review (set when Engineer completes)
- ✅ **Done** - Completed (set when Reviewer approves)

**Labels for Coordination:**
- `type:*` - Issue classification
- `orch:*-done` - Handoff signals (cumulative)
- `priority:p0-p3` - Urgency level
- `needs:*` - Special requirements

---

## 🤖 The Orchestrator

**Purpose:** Central coordinator managing handoffs and workflow state.

### Responsibilities
- Monitor orchestration labels for state changes
- Route issues to agents based on type and completion state
- Validate prerequisites (Epic has ADR, UX designs, etc.)
- Block issues when prerequisites missing
- Recover from errors (timeouts, missing artifacts)
- Track metrics (handoff latency, SLA compliance)

### State Machine

```
Epic (type:epic)
  ├─ No orch:pm-done → PM
  ├─ orch:pm-done → UX Designer (sequential)
  ├─ orch:ux-done → Architect (sequential)
  └─ orch:architect-done → Engineer

Story/Feature
  ├─ Check Epic has orch:ux-done
  ├─ No orch:engineer-done → Engineer
  └─ orch:engineer-done → Reviewer

Bug/Docs → Engineer → Reviewer
Spike → Architect → Close
```

### Invocation

**Automatic:** `.github/workflows/agent-orchestrator.yml` (triggers on label changes)

**Manual:**
```bash
gh workflow run agent-orchestrator.yml -f issue_number=71
```

### SLAs

| Handoff | Target |
|---------|--------|
| PM → UX | <30s |
| UX → Architect | <30s |
| Architect → Engineer | <30s |
| Engineer → Reviewer | <30s |
| Reviewer → Close | <5min |

---

## 🚨 Error Handling

| Error | Detection | Resolution |
|-------|-----------|------------|
| Agent timeout | No `orch:*-done` after 15 min | Add `needs:help` |
| Missing artifacts | `orch:*-done` but no files | Remove label, re-run |
| Blocked issue | Prerequisites not met | Add blocking comment |
| Test failures | CI fails after commit | Add `needs:fixes` |
| Review rejected | `needs:changes` label | Reassign to Engineer |

---

## 🛡️ Operational Controls

### Execution Modes

- **Standard (Default):** Pause at critical decisions, request confirmation
- **YOLO (Autonomous):** Fully autonomous execution without pauses
  - **Activate:** User says "YOLO" or "autonomous mode"
  - **Deactivate:** User says "stop" or "exit YOLO"

### Security Controls

**Blocked Commands:** `rm -rf /`, `git reset --hard`, `drop database`, `curl | bash`

**Iteration Limits:**
- General tasks: 15 attempts
- Bug fixes: 5 attempts
- Test retries: 3 attempts

**Security Checklist:**
- ✅ No hardcoded secrets
- ✅ SQL parameterization
- ✅ Input validation
- ✅ Dependencies scanned

---

## 📚 Quick Reference

### File Locations

| Need | Location |
|------|----------|
| MCP Config | `.vscode/mcp.json` |
| Production Standards | `Skills.md` |
| Agent Definitions | `.github/agents/*.agent.md` |
| **Templates** | `.github/templates/` |
| ADR Template | `.github/templates/ADR-TEMPLATE.md` |
| Spec Template | `.github/templates/SPEC-TEMPLATE.md` |
| PRD Template | `.github/templates/PRD-TEMPLATE.md` |
| UX Template | `.github/templates/UX-TEMPLATE.md` |
| Review Template | `.github/templates/REVIEW-TEMPLATE.md` |
| PRDs | `docs/prd/PRD-{issue}.md` |
| ADRs | `docs/adr/ADR-{issue}.md` |
| Specs | `docs/specs/SPEC-{issue}.md` |
| UX Designs | `docs/ux/UX-{issue}.md` |
| Reviews | `docs/reviews/REVIEW-{issue}.md` |

### Common Commands

```json
// Create issue
{"tool": "issue_write", "args": {"method": "create", "title": "[Story] Description", "labels": ["type:story"]}}

// Claim issue: Status is automatically updated by workflows
// - PM completes → Stories move to 'Ready'
// - Engineer starts → Status moves to 'In Progress'
// - Engineer completes → Status moves to 'In Review'
// - Reviewer approves → Status moves to 'Done'

// Trigger orchestrator (auto-triggers on label, or manual)
{"tool": "run_workflow", "args": {"workflow_id": "agent-orchestrator.yml", "inputs": {"issue_number": "ID"}}}

// Close issue
{"tool": "update_issue", "args": {"issue_number": ID, "state": "closed"}}
```

### Workflow Decision Tree

```
User Request
    │
    ├─ Research (Gate 1)
    ├─ Classify (Use Matrix)
    ├─ Create Issue (Gate 2)
    │
    ├─ type:epic → 📋 PM → PRD + Features
    ├─ type:feature → 🏗️ Architect → ADR + Spec
    ├─ type:spike → 🏗️ Architect → Research
    ├─ type:story → 🔧 Engineer → Code + Tests
    ├─ type:bug → 🔧 Engineer → Fix + Tests
    └─ type:docs → 🔧 Engineer → Documentation
```

---

## Support & Documentation

- **Full MCP Integration:** [docs/mcp-integration.md](docs/mcp-integration.md)
- **Orchestration Testing:** [docs/orchestration-testing-guide.md](docs/orchestration-testing-guide.md)
- **Production Skills:** [Skills.md](Skills.md) → 18 detailed skills
- **Contributor Guide:** [CONTRIBUTING.md](CONTRIBUTING.md)

---

**Version:** 2.0 Optimized  
**Last Updated:** January 19, 2026
