# Technical Specification: AgentX Multi-Agent System

> **Version**: 2.0  
> **Date**: January 19, 2026  
> **Status**: Current Implementation  
> **Standard**: [github/awesome-copilot](https://github.com/github/awesome-copilot) • [agentskills.io](https://agentskills.io/specification)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Agent Roles & Responsibilities](#3-agent-roles--responsibilities)
4. [Orchestration Model](#4-orchestration-model)
5. [Issue Classification & Routing](#5-issue-classification--routing)
6. [GitHub Projects Integration](#6-github-projects-integration)
7. [MCP Server Integration](#7-mcp-server-integration)
8. [Security Architecture](#8-security-architecture)
9. [File Structure](#9-file-structure)
10. [Quality Standards](#10-quality-standards)

---

## 1. Executive Summary

### 1.1 Purpose

AgentX is a **multi-agent orchestration system** that coordinates AI agents (Product Manager, Architect, UX Designer, Engineer, Reviewer) to collaboratively deliver production-ready software using GitHub Issues, GitHub Projects, and GitHub Actions.

### 1.2 Key Principles

- **Issue-First**: All work starts with a GitHub Issue created BEFORE coding
- **Single Workflow**: One unified `agent-orchestrator.yml` handles all agents
- **GitHub Native**: Uses GitHub Projects Status field (no custom status labels)
- **Event-Driven**: Agents trigger next agent via orchestration labels
- **Role-Based**: Request type determines agent role automatically

### 1.3 Current State

| Component | Status |
|-----------|--------|
| Unified Workflow | ✅ Implemented ([agent-orchestrator.yml](../.github/workflows/agent-orchestrator.yml)) |
| GitHub Projects Integration | ✅ Status field (Backlog, In Progress, In Review, Done) |
| MCP Server | ✅ Configured (GitHub Copilot hosted) |
| Orchestration Labels | ✅ `orch:pm-done`, `orch:architect-done`, `orch:ux-done`, `orch:engineer-done` |
| Documentation | ✅ [AGENTS.md](../AGENTS.md), [Skills.md](../Skills.md), [CONTRIBUTING.md](../CONTRIBUTING.md) |

---

## 2. Architecture Overview

### 2.1 System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    AgentX Multi-Agent System                     │
└──────────────────────────────────────────────────────────────────┘

                        User Request
                             │
                             ▼
                    ┌─────────────────┐
                    │  Classification │ (Research → Classify)
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
    ┌────────┐         ┌─────────┐        ┌─────────┐
    │ Epic   │         │ Feature │        │  Story  │
    │ PM     │         │ Architect│       │ Engineer│
    └────┬───┘         └────┬────┘        └────┬────┘
         │                  │                   │
         │ orch:pm-done     │ orch:architect-   │
         │                  │ done              │
         ▼                  ▼                   ▼
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │ Features│        │ Stories │        │ Review  │
    │ +Stories│        │         │        │         │
    └─────────┘        └─────────┘        └─────────┘
```

### 2.2 Technology Stack

| Layer | Technology |
|-------|------------|
| **Agent Orchestration** | GitHub Actions (unified workflow) |
| **Task Management** | GitHub Issues + GitHub Projects v2 |
| **API Integration** | GitHub MCP Server (Model Context Protocol) |
| **Agent Communication** | Orchestration labels (`orch:*`) |
| **Status Tracking** | GitHub Projects Status field |
| **Documentation** | Markdown (AGENTS.md, Skills.md) |

### 2.3 Simplified Workflow Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     Unified Agent Workflow                       │
│             (.github/workflows/agent-orchestrator.yml)           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Trigger: issues.labeled, workflow_dispatch                     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Routing Logic (based on labels)                           │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ type:epic (no orch:pm-done)        → Product Manager      │ │
│  │ orch:pm-done (no architect/ux)     → Architect + UX (||)  │ │
│  │ orch:architect-done + orch:ux-done → Engineer             │ │
│  │ orch:engineer-done                 → Reviewer             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Each agent:                                                     │
│  1. Comments on issue (starting work)                           │
│  2. Executes role-specific tasks                                │
│  3. Commits deliverables                                         │
│  4. Adds completion label (orch:*-done)                         │
│  5. Triggers next agent automatically                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Agent Roles & Responsibilities

### 3.1 Agent Matrix

| Agent | Trigger | Input | Output | Handoff |
|-------|---------|-------|--------|---------|
| **📋 Product Manager** | `type:epic` | User requirements | PRD + Feature/Story backlog | `orch:pm-done` |
| **🏗️ Architect** | `orch:pm-done` | PRD, technical requirements | ADR + Tech Specs | `orch:architect-done` |
| **🎨 UX Designer** | `orch:pm-done` (parallel) | PRD, user flows | Wireframes + Prototypes | `orch:ux-done` |
| **🔧 Engineer** | Both architect + UX done | Tech Spec + UX design | Code + Tests + Docs | `orch:engineer-done` |
| **✅ Reviewer** | `orch:engineer-done` | Code changes | Review doc + Approval | Close issue |

### 3.2 Agent Execution Pattern

```yaml
# Each agent follows this pattern in agent-orchestrator.yml

product-manager-agent:
  if: github.event.label.name == 'type:epic' && !contains(github.event.issue.labels.*.name, 'orch:pm-done')
  steps:
    - name: Comment on issue
      run: gh issue comment ${{ github.event.issue.number }} --body "🚀 Product Manager starting..."
    
    - name: Execute agent role
      run: |
        # Research, create PRD, break into Features + Stories
        
    - name: Add completion label
      run: gh issue edit ${{ github.event.issue.number }} --add-label "orch:pm-done"
```

### 3.3 Parallel Execution (Architect + UX)

When PM completes an Epic, **both Architect and UX Designer** are triggered simultaneously:

- **Architect** reviews entire backlog → creates ADR + Tech Specs
- **UX Designer** reviews entire backlog → creates wireframes + prototypes

Both add their completion labels to the Epic. Engineer only starts when **BOTH** labels are present.

---

## 4. Orchestration Model

### 4.1 Label-Based Routing

```
Epic Issue Created (#48)
    │
    ├─ Label: type:epic
    │
    ▼
┌─────────────────────────────────────────────────┐
│ agent-orchestrator.yml detects type:epic        │
│ Triggers: Product Manager Agent                 │
└─────────────────────────────────────────────────┘
    │
    ▼
PM completes → Adds label: orch:pm-done
    │
    ├──────────────────┬─────────────────┐
    │ (Parallel)       │                 │
    ▼                  ▼                 │
┌──────────────┐  ┌─────────────┐       │
│ Architect    │  │ UX Designer │       │
│ (triggered)  │  │ (triggered) │       │
└──────┬───────┘  └──────┬──────┘       │
       │                 │              │
       │ orch:architect- │ orch:ux-done │
       │ done            │              │
       └────────┬────────┘              │
                │                       │
                ▼                       │
    Both labels present? YES            │
                │                       │
                ▼                       │
        ┌──────────────┐                │
        │  Engineer    │                │
        │  (triggered) │                │
        └──────┬───────┘                │
               │ orch:engineer-done     │
               ▼                        │
        ┌──────────────┐                │
        │   Reviewer   │                │
        │  (triggered) │                │
        └──────┬───────┘                │
               │                        │
               ▼                        │
        Close Issue (Done)              │
```

### 4.2 Orchestration Labels

| Label | Purpose | Added By | Triggers |
|-------|---------|----------|----------|
| `orch:pm-done` | PM work complete | Product Manager | Architect + UX Designer |
| `orch:architect-done` | Architecture complete | Architect | (waits for UX) |
| `orch:ux-done` | UX design complete | UX Designer | (waits for Architect) |
| `orch:engineer-done` | Implementation complete | Engineer | Reviewer |

### 4.3 Handoff SLAs

| Handoff | Target Latency |
|---------|----------------|
| PM → Architect + UX | < 30 seconds |
| Architect + UX → Engineer | < 30 seconds |
| Engineer → Reviewer | < 30 seconds |
| Reviewer → Close | < 5 minutes |

---

## 5. Issue Classification & Routing

### 5.1 Classification Decision Tree

```
User Request
    │
    ▼
Q1: Something broken? → YES: type:bug (Engineer)
    │ NO
    ▼
Q2: Research needed? → YES: type:spike (Architect)
    │ NO
    ▼
Q3: Documentation only? → YES: type:docs (Engineer)
    │ NO
    ▼
Q4: Large/vague/multi-feature? → YES: type:epic (PM)
    │ NO
    ▼
Q5: Single capability? → YES: type:feature (Architect)
    │ NO
    ▼
Default: type:story (Engineer)
```

### 5.2 Issue Type Matrix

| Type | Keywords | Agent | Deliverable |
|------|----------|-------|-------------|
| `type:epic` | "build me...", "platform", "system" | Product Manager | PRD + Backlog |
| `type:feature` | "add X feature", "implement Y" | Architect | ADR + Tech Spec |
| `type:story` | "button", "field", "validation" | Engineer | Code + Tests |
| `type:bug` | "broken", "fix", "error" | Engineer | Fix + Tests |
| `type:spike` | "research", "evaluate", "compare" | Architect | Research Doc |
| `type:docs` | "document", "readme", "update docs" | Engineer | Documentation |

### 5.3 Additional Labels

| Category | Labels | Purpose |
|----------|--------|---------|
| **Priority** | `priority:p0` (critical) through `priority:p3` (low) | Determine urgency |
| **Workflow** | `needs:ux`, `needs:help`, `needs:changes`, `needs:fixes` | Flag special requirements |

---

## 6. GitHub Projects Integration

### 6.1 Status Field Values

AgentX uses the **native GitHub Projects Status field** instead of custom labels:

| Status | When | Who Sets |
|--------|------|----------|
| **Backlog** | Issue created | System (auto) |
| **In Progress** | Agent claims work | Agent |
| **In Review** | Code review phase | Engineer |
| **Done** | Completed | Reviewer (via close) |

**Optional (for visibility):**
| **Ready** | Design complete, awaiting Engineer | Architect + UX Designer |

### 6.2 Why GitHub Projects?

✅ **Native UI** - Clean visual board  
✅ **Mutually Exclusive** - Only one status at a time  
✅ **No Custom Labels** - Reduces label pollution  
✅ **Easy Queries** - Standard GitHub API  
✅ **Single Source of Truth** - One field to manage

### 6.3 Setup

See [docs/project-setup.md](project-setup.md) for complete instructions.

```bash
# 1. Create GitHub Project v2
gh project create --owner jnPiyush --title "AgentX"

# 2. Add Status field (single-select)
# Values: Backlog, In Progress, In Review, Done, Ready (optional)

# 3. Link repository
gh project link <PROJECT_ID> --repo jnPiyush/AgentX
```

---

## 7. MCP Server Integration

### 7.1 Configuration

**File:** `.vscode/mcp.json`

```json
{
  "servers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    }
  }
}
```

**Requirements:**
- VS Code 1.101+
- GitHub Copilot subscription
- OAuth authentication (automatic)

### 7.2 Available Tools

| Tool | Purpose | Example |
|------|---------|---------|
| `issue_write` | Create/update issues | Create Epic with labels |
| `update_issue` | Add labels, close | Add `orch:pm-done` label |
| `add_issue_comment` | Post updates | "Starting implementation..." |
| `run_workflow` | Trigger workflows | Trigger next agent |
| `list_issues` | Query issues | Find ready tasks |

### 7.3 Example: Agent Handoff

```json
// PM Agent completes work
{
  "tool": "add_issue_comment",
  "args": {
    "owner": "jnPiyush",
    "repo": "AgentX",
    "issue_number": 48,
    "body": "✅ PRD created. Created 3 Features, 8 Stories."
  }
}

// Add completion label (auto-triggers Architect + UX)
{
  "tool": "update_issue",
  "args": {
    "owner": "jnPiyush",
    "repo": "AgentX",
    "issue_number": 48,
    "labels": ["type:epic", "orch:pm-done"]
  }
}
```

See [docs/mcp-integration.md](mcp-integration.md) for complete tool reference.

---

## 8. Security Architecture

### 8.1 Four-Layer Security Model

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Actor Allowlist                                    │
├─────────────────────────────────────────────────────────────┤
│ Who can trigger autonomous workflows?                       │
│ Config: .github/autonomous-mode.yml                         │
│ Example: allowed_actors: [jnPiyush, github-actions[bot]]   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Protected Paths                                    │
├─────────────────────────────────────────────────────────────┤
│ What files require human review?                           │
│ Example: .github/*, package.json, *.csproj                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Kill Switch                                        │
├─────────────────────────────────────────────────────────────┤
│ Emergency stop for all autonomous operations               │
│ Method: Set autonomous_mode_enabled: false                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Audit Trail                                        │
├─────────────────────────────────────────────────────────────┤
│ Every action logged via GitHub Issues comments             │
│ All commits reference issue numbers                        │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Blocked Commands

Agents **never execute**:
- `rm -rf /` - Destructive file operations
- `git reset --hard` - Loses uncommitted work
- `drop database` - Destructive database operations
- `curl <url> | bash` - Arbitrary code execution

### 8.3 Iteration Limits

| Operation | Max Attempts |
|-----------|--------------|
| General task iterations | 15 |
| Bug fix attempts | 5 |
| Test retries | 3 |
| API retry attempts | 3 |

---

## 9. File Structure

### 9.1 Repository Layout

```
AgentX/
├── .github/
│   ├── copilot-instructions.md       # Gate file (read first)
│   ├── workflows/
│   │   ├── agent-orchestrator.yml    # Unified workflow
│   │   └── test-e2e.yml             # E2E tests
│   ├── agents/                       # Agent definitions (legacy)
│   ├── instructions/                 # Language-specific rules
│   └── prompts/                      # Reusable prompts
├── docs/
│   ├── prd/                          # Product requirements
│   ├── adr/                          # Architecture decisions
│   ├── specs/                        # Technical specifications
│   ├── ux/                           # UX designs
│   ├── reviews/                      # Code reviews
│   ├── project-setup.md              # GitHub Projects guide
│   ├── mcp-integration.md            # MCP Server guide
│   └── technical-specification.md    # This file
├── skills/                           # 18 production skills
├── tests/e2e/                        # End-to-end tests
├── AGENTS.md                         # Authoritative workflow doc
├── Skills.md                         # Skills index
├── CONTRIBUTING.md                   # Contributor guide
└── install.ps1 / install.sh          # Setup scripts
```

### 9.2 Artifact Locations

| Artifact | Pattern | Example |
|----------|---------|---------|
| PRD | `docs/prd/PRD-{issue}.md` | `docs/prd/PRD-48.md` |
| ADR | `docs/adr/ADR-{issue}.md` | `docs/adr/ADR-50.md` |
| Tech Spec | `docs/specs/SPEC-{issue}.md` | `docs/specs/SPEC-50.md` |
| UX Design | `docs/ux/UX-{issue}.md` | `docs/ux/UX-51.md` |
| Review | `docs/reviews/REVIEW-{issue}.md` | `docs/reviews/REVIEW-52.md` |

### 9.3 Commit Message Format

```
type: description (#issue)

Optional longer explanation
```

**Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

**Example:**
```bash
git commit -m "feat: add OAuth login support (#123)"
```

---

## 10. Quality Standards

### 10.1 Skills Framework

AgentX defines **18 production skills** in [Skills.md](../Skills.md):

| Category | Skills |
|----------|--------|
| **Foundation** | Core Principles, Testing, Error Handling, Security |
| **Architecture** | Performance, Database, Scalability, Code Organization, API Design |
| **Development** | Configuration, Documentation, Version Control, Type Safety, Dependencies, Logging |
| **Operations** | Remote Git Operations, Code Review & Audit |
| **AI Systems** | AI Agent Development |

### 10.2 Quality Gates (All Must Pass)

✅ All tests passing with ≥80% code coverage  
✅ No compiler warnings or linter errors  
✅ No security violations (secrets, SQL injection, XSS)  
✅ All child issues properly linked  
✅ Commit messages reference issue numbers  

### 10.3 Test Pyramid

- **70% Unit Tests** - Fast, isolated component tests
- **20% Integration Tests** - Components working together
- **10% E2E Tests** - Full user flows

### 10.4 Documentation Requirements

- XML docs for all public APIs (C#)
- Docstrings for all functions (Python)
- JSDoc for exported functions (JavaScript)
- README in each module folder

---

## Appendix A: Quick Reference

### Common Commands

```bash
# Create issue
gh issue create --title "[Epic] Build authentication" --label "type:epic"

# Claim issue (move to In Progress in Projects UI)

# Commit with issue reference
git commit -m "feat: add OAuth login (#123)"

# Close issue
gh issue close 123 --comment "Completed in commit abc123"

# Trigger workflow manually
gh workflow run agent-orchestrator.yml -f issue_number=123
```

### Label Quick Reference

```bash
# Type labels (determines agent)
type:epic, type:feature, type:story, type:bug, type:spike, type:docs

# Orchestration labels (agent coordination)
orch:pm-done, orch:architect-done, orch:ux-done, orch:engineer-done

# Priority labels
priority:p0, priority:p1, priority:p2, priority:p3

# Workflow labels
needs:ux, needs:help, needs:changes, needs:fixes
```

---

## Appendix B: Related Documents

- **[AGENTS.md](../AGENTS.md)** - Complete workflow details, agent behaviors
- **[Skills.md](../Skills.md)** - Technical standards index
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Contributor guide (manual workflow)
- **[docs/project-setup.md](project-setup.md)** - GitHub Projects setup
- **[docs/mcp-integration.md](mcp-integration.md)** - MCP Server integration
- **[.github/copilot-instructions.md](../.github/copilot-instructions.md)** - Agent gate file

---

**Document Version:** 2.0  
**Last Updated:** January 19, 2026  
**Maintained By:** AgentX Team
