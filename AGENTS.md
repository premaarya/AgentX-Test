---
description: 'AI agent guidelines for production-ready code.'
applyTo: '**'
---

# AI Agent Guidelines

> **AUTHORITATIVE SOURCE**: This document is the single source of truth for all agent behavior, workflows, and guidelines. The Copilot instructions file is just a gate that enforces reading this document first.

---

## 🚨 MANDATORY GATE: Issue-First Workflow

**CRITICAL**: Before ANY file modification, you MUST:
1. **CREATE** a GitHub Issue (if one doesn't exist)
2. **CLAIM** the issue (mark `status:in-progress`)
3. **THEN** proceed with work

**Why This Matters:**
- **Audit Trail**: Changes must be traceable to decisions made BEFORE work began
- **Coordination**: Other agents need visibility into active work
- **Session Handoffs**: Context must be established and persistent
- **Accountability**: Every modification requires justification

**Retroactive Issues = Workflow Violation** - Creating issues after work is done defeats the purpose.

---

## ⛔ Issue-First Workflow (Mandatory)

### Using MCP Tools (Primary)
```json
// Step 1: Create issue
{ "tool": "issue_write", "args": { "owner": "jnPiyush", "repo": "AgentX", "method": "create", "title": "[Type] Description", "body": "Description", "labels": ["type:task", "status:ready"] } }

// Step 2: Claim issue
{ "tool": "update_issue", "args": { "owner": "jnPiyush", "repo": "AgentX", "issue_number": <ID>, "labels": ["type:task", "status:in-progress"] } }

// Step 3: Close issue
{ "tool": "update_issue", "args": { "owner": "jnPiyush", "repo": "AgentX", "issue_number": <ID>, "state": "closed", "labels": ["type:task", "status:done"] } }
{ "tool": "add_issue_comment", "args": { "owner": "jnPiyush", "repo": "AgentX", "issue_number": <ID>, "body": "Done in <SHA>" } }
```

### Using CLI (Fallback)
```bash
gh issue create --title "[Type] Description" --body "Description" --label "type:task,status:ready"
gh issue edit <ID> --add-label "status:in-progress" --remove-label "status:ready"
git commit -m "type: description (#ID)"
gh issue close <ID> --comment "Done in <SHA>"
```

---

## 🔬 Research-First Workflow

> **CRITICAL**: Every user request requires research BEFORE taking action.

### Research Steps (Mandatory)

1. **UNDERSTAND**
   - What is the user actually asking for?
   - What problem are they trying to solve?
   - What is the expected outcome?

2. **RESEARCH**
   - Search codebase for existing patterns
   - Check for related code, tests, documentation
   - Understand current architecture and conventions
   - Identify dependencies and potential impacts

3. **CLASSIFY** (see classification matrix below)
   - Determine request type: Epic/Feature/Story/Bug/Spike/Docs
   - Assess scope: Large/Medium/Small
   - Identify if UX work needed (→ needs:ux label)

4. **CREATE APPROPRIATE ISSUE**
   - Create issue with correct type label
   - Then proceed with work

**Research Actions:**
- `semantic_search` - Find relevant code by concept
- `grep_search` - Find exact patterns/strings
- `file_search` - Find files by name
- `read_file` - Understand existing implementations
- `list_dir` - Explore project structure

---

## 📋 Request Classification

Before creating an issue, classify the user's request:

### Classification Criteria

| Type | Scope | Clarity | Needs PRD? | Needs Breakdown? | Keywords |
|------|-------|---------|------------|------------------|----------|
| `type:epic` | Multi-feature | Vague/broad | ✅ Yes | ✅ Yes | "platform", "system", "application", "build me a..." |
| `type:feature` | Single capability | Medium | Maybe | Maybe | "add X feature", "implement Y", "create Z capability" |
| `type:story` | Single behavior | Well-defined | No | No | "button", "field", "validation", "when user clicks..." |
| `type:bug` | Fix | Clear problem | No | No | "broken", "fix", "error", "doesn't work", "fails" |
| `type:spike` | Research | Open-ended | No | No | "research", "evaluate", "compare", "investigate", "should we use..." |
| `type:docs` | Documentation | Clear | No | No | "document", "readme", "update docs", "add comments" |

### Classification Decision Tree

```
User Request → Q1: Broken? → YES: type:bug
              → NO → Q2: Research? → YES: type:spike
                    → NO → Q3: Docs only? → YES: type:docs
                          → NO → Q4: Large/vague? → YES: type:epic
                                → NO → Q5: Single capability? → YES: type:feature
                                      → NO: type:story
                                → Q6: Has UI? → YES: Add needs:ux
```

### Examples

| User Request | Classification | Labels | Why |
|-------------|----------------|--------|-----|
| "Build me an e-commerce platform" | Epic | `type:epic` | Large, vague, multi-feature |
| "Add user authentication with OAuth" | Feature | `type:feature,needs:ux` | Single capability, has UI |
| "Add a logout button to the header" | Story | `type:story,needs:ux` | Small, specific, has UI |
| "Create an API endpoint for user data" | Story | `type:story` | Small, specific, no UI |
| "The login page returns 500 error" | Bug | `type:bug` | Something broken |
| "Should we use PostgreSQL or MongoDB?" | Spike | `type:spike` | Research/evaluation |
| "Update the README with setup instructions" | Docs | `type:docs` | Documentation only |

---

## 🚀 Handling Direct Chat Requests

When a user asks for something directly in chat:

### Workflow
```
1. RESEARCH (mandatory) → Understand codebase context
2. CLASSIFY → Determine issue type
3. CREATE ISSUE → With proper labels
4. CLAIM ISSUE → Mark in-progress
5. PROCEED → Based on issue type
```

### Agent Roles by Issue Type

| Issue Type | Agent Role | Actions |
|-----------|------------|---------|
| `type:epic` | Product Manager | Create PRD at `docs/prd/PRD-{issue}.md`, break into Features/Stories, link hierarchy |
| `type:feature` | Architect | Create ADR at `docs/adr/ADR-{issue}.md` + Tech Spec at `docs/specs/SPEC-{issue}.md` |
| `type:spike` | Architect | Research, document findings, make recommendation |
| `type:story` | Engineer | Implement directly, write tests, commit with issue reference |
| `type:bug` | Engineer | Fix directly, write tests, commit with issue reference |
| `type:docs` | Engineer | Write documentation, commit with issue reference |

---

## Labels

| Category | Labels |
|----------|--------|
| **Type** | `type:epic`, `type:feature`, `type:story`, `type:bug`, `type:spike`, `type:docs` |
| **Status** | `status:ready`, `status:in-progress`, `status:done` |
| **Priority** | `priority:p0`, `priority:p1`, `priority:p2`, `priority:p3` |

---

## GitHub Tools

### MCP Server (Primary) ✅
Config: `.vscode/mcp.json` → `https://api.githubcopilot.com/mcp/`

| Tool | Purpose |
|------|---------|
| `issue_write` | Create/update issues |
| `update_issue` | Update labels/state |
| `add_issue_comment` | Add comments |
| `run_workflow` | Trigger workflows |
| `list_workflow_runs` | Check workflow status |
| `get_workflow_run` | Get run details |
| `pull_request_read` | Get PR details |
| `create_pull_request` | Create PRs |
| `get_file_contents` | Read repo files |
| `search_code` | Search codebase |

### CLI (Fallback Only)
```bash
gh issue create/edit/close    # When MCP unavailable
gh workflow run <file>        # When MCP unavailable
```

---

## Execution Modes

**Standard**: Pause at critical decisions  
**YOLO**: Autonomous execution (say "YOLO" to activate, "stop" to exit)

---

## Security

**Blocked**: `rm -rf`, `git reset --hard`, `drop database`, `curl | bash`

**Limits**: 15 iterations/task, 5 bug fix attempts, 3 test retries

---

## 🔄 Multi-Agent Orchestration (Mandatory Workflow)

> **CRITICAL**: This section defines HOW agents hand off work to each other. Follow this workflow for all multi-step tasks.

### Agent Roles & Responsibilities

| Agent Role | Triggered By | Primary Responsibility | Deliverables | Next Agent |
|-----------|--------------|------------------------|--------------|------------|
| **Product Manager** | `type:epic` | Break down large initiatives | PRD + Feature backlog | Architect |
| **Architect** | `type:feature` or `type:spike` | Design & technical planning | ADR + Tech Spec | Engineer |
| **Engineer** | `type:story`, `type:bug`, `type:docs` | Implementation | Code + Tests + Docs | Reviewer |
| **Reviewer** | `orch:engineer-done` | Quality assurance | Code review + approval | Close |

---

### 📋 Complete Orchestration Flow

```
Epic Issue Created (#48)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ PRODUCT MANAGER AGENT                                        │
│ Trigger: type:epic label detected                           │
│                                                              │
│ Tasks:                                                       │
│ 1. Read issue description and understand scope              │
│ 2. Research existing architecture and constraints           │
│ 3. Create PRD at docs/prd/PRD-48.md                        │
│ 4. Break down into Feature issues (type:feature)            │
│ 5. Create child issues with "Parent: #48" in body           │
│ 6. Add orch:pm-done label to original epic                  │
│ 7. Comment with summary + links to child issues             │
│                                                              │
│ Handoff: Triggers Architect for EACH Feature                │
└─────────────────────────────────────────────────────────────┘
    │
    ▼ (for each Feature #50, #51, #52...)
┌─────────────────────────────────────────────────────────────┐
│ ARCHITECT AGENT                                              │
│ Trigger: type:feature or type:spike label detected          │
│                                                              │
│ Tasks:                                                       │
│ 1. Read feature description (and parent PRD if exists)      │
│ 2. Research codebase for integration points                 │
│ 3. Create ADR at docs/adr/ADR-50.md (architecture decision) │
│ 4. Create Tech Spec at docs/specs/SPEC-50.md               │
│ 5. If type:spike, document research findings + recommendation│
│ 6. Break down into Story issues (type:story)                │
│ 7. Add orch:architect-done label                            │
│ 8. Comment with summary + links to child stories            │
│                                                              │
│ Handoff: Triggers Engineer for EACH Story                   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼ (for each Story #60, #61, #62...)
┌─────────────────────────────────────────────────────────────┐
│ ENGINEER AGENT                                               │
│ Trigger: type:story, type:bug, or type:docs detected        │
│                                                              │
│ Tasks:                                                       │
│ 1. Read story/bug description (and specs if exist)          │
│ 2. Research codebase for implementation location            │
│ 3. Implement the change following Skills.md standards       │
│ 4. Write unit tests (70%), integration tests (20%)          │
│ 5. Update/create documentation (XML docs, README, etc.)     │
│ 6. Run tests and verify ≥80% coverage                       │
│ 7. Commit with message: "type: description (#60)"           │
│ 8. Add orch:engineer-done label                             │
│ 9. Comment with summary + commit SHA                        │
│                                                              │
│ Handoff: Triggers Reviewer                                  │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ REVIEWER AGENT                                               │
│ Trigger: orch:engineer-done label detected                  │
│                                                              │
│ Tasks:                                                       │
│ 1. Read commit diff and code changes                        │
│ 2. Verify tests exist and pass                              │
│ 3. Check code quality (Skills.md standards)                 │
│ 4. Verify security (no secrets, SQL injection prevention)   │
│ 5. Create review document at docs/reviews/REVIEW-60.md     │
│ 6. If approved:                                              │
│    - Close issue with status:done label                     │
│    - Comment "✅ Approved - meets quality standards"        │
│ 7. If changes needed:                                        │
│    - Add needs:changes label                                │
│    - Comment with specific feedback                         │
│    - Remove orch:engineer-done, reassign to Engineer        │
└─────────────────────────────────────────────────────────────┘
```

---

### 🎯 Handoff Protocol (Mandatory Steps)

#### When Completing Your Role:

1. **Document Your Work**
   - Create appropriate artifacts (PRD, ADR, Spec, Code, Review)
   - Commit with proper message format: `type: description (#issue)`
   - Reference parent issues in commit body if hierarchical

2. **Update Issue State**
   ```json
   // Add orchestration label
   { "tool": "update_issue", "args": { "owner": "jnPiyush", "repo": "AgentX", "issue_number": <ID>, "labels": ["orch:role-done"] } }
   ```

3. **Post Summary Comment**
   ```json
   { "tool": "add_issue_comment", "args": { "owner": "jnPiyush", "repo": "AgentX", "issue_number": <ID>, "body": "## Completed: [Role]\n\n**Deliverables:**\n- [List artifacts created]\n\n**Next Steps:**\n- [What needs to happen next]\n\n**Links:**\n- Commits: [SHA]\n- Child Issues: #X, #Y, #Z" } }
   ```

4. **Trigger Next Agent** (if applicable)
   ```json
   // For child issues (Feature from Epic, Story from Feature)
   { "tool": "issue_write", "args": { "method": "create", "title": "[Type] Description", "body": "Parent: #<ID>\n\n## Description\n[Details]", "labels": ["type:story", "status:ready"] } }
   
   // OR trigger workflow for next agent via MCP
   { "tool": "run_workflow", "args": { "owner": "jnPiyush", "repo": "AgentX", "workflow_id": "run-engineer.yml", "ref": "master", "inputs": { "issue_number": "60" } } }
   ```

---

### 🔍 Determining When to Hand Off

#### Product Manager → Architect
**Trigger:** All features identified and documented in PRD  
**Signal:** `orch:pm-done` label added  
**Action:** Create child Feature issues, comment on Epic with summary

#### Architect → Engineer
**Trigger:** Technical design complete (ADR + Spec written)  
**Signal:** `orch:architect-done` label added  
**Action:** Create child Story issues, comment on Feature with summary

#### Engineer → Reviewer
**Trigger:** Implementation complete, tests passing, code committed  
**Signal:** `orch:engineer-done` label added  
**Action:** Commit code, comment on Story with commit SHA

#### Reviewer → Close
**Trigger:** Code review passed quality gates  
**Signal:** Review approved in docs/reviews/REVIEW-{issue}.md  
**Action:** Close issue with `status:done` label

---

### ⚡ Implementation Methods

#### Method 1: GitHub Actions (Automated)
```bash
# PM completes work, triggers Architect workflow
gh workflow run run-architect.yml -f issue_number=50

# Architect completes, triggers Engineer workflow
gh workflow run run-engineer.yml -f issue_number=60

# Engineer completes, triggers Reviewer workflow
gh workflow run run-reviewer.yml -f issue_number=60
```

#### Method 2: MCP Server (Direct)
```json
// Trigger next agent directly via MCP
{ "tool": "run_workflow", "args": { "owner": "jnPiyush", "repo": "AgentX", "workflow_id": "run-engineer.yml", "ref": "master", "inputs": { "issue_number": "60" } } }
```

#### Method 3: Polling (Fallback)
```yaml
# Scheduled workflow checks for orch:*-done labels every 5 minutes
# Automatically triggers next agent in chain
# See: .github/workflows/orchestration-polling.yml
```

---

### 🚨 Error Handling in Orchestration

| Error Scenario | Detection | Resolution |
|----------------|-----------|------------|
| **Agent fails to complete** | Timeout (15 min) | Add `needs:help` label, notify user |
| **Child issue not created** | No child issues after `orch:*-done` | Re-run agent workflow |
| **Circular dependency** | Issue references itself as parent | Human intervention required |
| **Missing artifacts** | No PRD/ADR/Spec/Code committed | Remove `orch:*-done`, restart agent |
| **Test failures** | CI/CD pipeline fails | Add `needs:fixes` label, reassign to Engineer |

---

### 📊 Orchestration Metrics

**Target SLAs:**
- PM → Architect handoff: <30 seconds
- Architect → Engineer handoff: <30 seconds  
- Engineer → Reviewer handoff: <30 seconds
- Reviewer approval: <5 minutes

**Quality Gates:**
- All artifacts created per role requirements
- All tests passing (≥80% coverage)
- No security violations detected
- All child issues properly linked

---

### 🧪 Testing Orchestration

See [docs/orchestration-testing-guide.md](docs/orchestration-testing-guide.md) for:
- E2E test scenarios (5 complete flows)
- Validation scripts for each handoff
- Cleanup scripts for test data
- >85% test coverage maintained

---

## Quick Reference

| Need | Location |
|------|----------|
| MCP config | `.vscode/mcp.json` |
| Security | `.github/autonomous-mode.yml` |
| Standards | `Skills.md` |
| Agents | `.github/agents/*.agent.md` |


