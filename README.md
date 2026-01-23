# AgentX - AI-Powered Development Accelerator

[![Standard](https://img.shields.io/badge/Standard-awesome--copilot-green)](https://github.com/github/awesome-copilot)
[![Skills Spec](https://img.shields.io/badge/Skills-agentskills.io-orange)](https://agentskills.io/specification)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)]()
[![Install](https://img.shields.io/badge/Install-pip%20install%20agentx--cli-blue)]()

> **Installable CLI tool that brings AI agents to your project in 5 minutes. No hosting, no Docker, no complexity.**

---

## 🎯 What is AgentX?

AgentX is a **Python CLI tool** that adds AI-powered agents to any project (new or existing) to accelerate:
- **Code Development** - Engineer agent implements features with tests
- **Backlog Management** - PM agent creates PRDs and decomposes epics
- **Design Creation** - Architect agent creates ADRs and technical specs
- **UX Development** - UX agent creates wireframes and user flows
- **Critical Thinking** - Multi-agent conversations for complex decisions

**Install in 30 seconds. Start using in 5 minutes.**

```bash
pip install agentx-cli       # Install
agentx init                   # Initialize in your project
agentx create-prd 123         # Create PRD for issue #123
```

**Zero cost. Zero hosting. Zero complexity.**

---

## 🚀 Quick Start

### 1. Install AgentX

```bash
# From PyPI (when published)
pip install agentx-cli

# Or from GitHub
pip install git+https://github.com/jnPiyush/AgentX.git

# Or clone and install locally
git clone https://github.com/jnPiyush/AgentX.git && cd AgentX
pip install -e .
```

### 2. Initialize in Your Project

```bash
cd /path/to/your-project
agentx init                    # Creates .github/, agentx.yaml, docs/
export GITHUB_TOKEN=ghp_xxx    # Configure GitHub token
```

### 3. Use It!

```bash
# Create PRD for an issue
agentx create-prd 123

# Create technical architecture
agentx create-adr 456

# Implement a feature
agentx implement 789

# Multi-agent collaboration
agentx collaborate 100 --agents pm,architect
```

**See:** [CLI Quick Start Guide](docs/CLI-QUICKSTART.md) for full usage examples.

---

## ✨ Key Features

### 🎯 5 AI Agents

| Agent | Command | Output |
|-------|---------|--------|
| **Product Manager** | `agentx create-prd <issue>` | PRD + Features + Stories |
| **Solution Architect** | `agentx create-adr <issue>` | ADR + Technical Spec |
| **UX Designer** | `agentx design <issue>` | Wireframes + User Flows |
| **Software Engineer** | `agentx implement <issue>` | Code + Tests (80%+ coverage) |
| **Code Reviewer** | `agentx review <pr>` | Review + Security Analysis |

### 🧠 Multi-Agent Conversations

```bash
# PM and Architect collaborate on Epic planning
agentx collaborate 100 --agents pm,architect

# Output:
# ✅ PM: Drafts PRD
# ✅ Architect: Reviews for technical feasibility
# ✅ PM: Addresses concerns
# ✅ Architect: Creates ADR
# ✅ Both: Finalize plan
```

### 📚 18 Production Skills

All agents follow production-grade skills:
- **Testing** (xUnit, 80%+ coverage)
- **Security** (OWASP Top 10, input validation)
- **Performance** (async, caching, profiling)
- **API Design** (REST, versioning, OpenAPI)
- **Documentation** (XML docs, README)
- **...and 13 more** ([see all](Skills.md))

### 🔄 GitHub Actions Automation

**Auto-execute agents when issues are labeled:**

```yaml
# .github/workflows/agent-orchestrator.yml (auto-generated)
on:
  issues:
    types: [labeled]

# Label 'type:feature' → PM agent creates PRD
# Label 'type:story' → Engineer agent implements
```

### 🎨 Template-Based Documents

All documents use standardized templates:
- **PRD** - Product Requirements Document
- **ADR** - Architecture Decision Record
- **Spec** - Technical Specification
- **UX** - UX Design Document
- **Review** - Code Review Report

---

## 📋 What Gets Created

**Run `agentx init` in your project:**

```
your-project/
├─ .github/
│  ├─ workflows/        ✅ Auto-agent execution (GitHub Actions)
│  ├─ agents/           ✅ 5 agent definitions (PM, Architect, etc.)
│  ├─ skills/           ✅ 18 production skills
│  └─ templates/        ✅ Document templates (PRD, ADR, etc.)
├─ docs/
│  ├─ prd/              ✅ Generated PRDs
│  ├─ adr/              ✅ Generated ADRs
│  ├─ specs/            ✅ Generated specs
│  ├─ ux/               ✅ Generated UX docs
│  └─ reviews/          ✅ Generated reviews
└─ agentx.yaml          ✅ Configuration file
```

**Total setup time:** 30 seconds

---

## 💡 Use Cases

**1. Feature Development**
```bash
# Issue #123: Add OAuth login
agentx create-prd 123     # PM creates PRD
agentx create-adr 123     # Architect creates technical design
agentx implement 123      # Engineer implements with tests
agentx review 456         # Reviewer checks PR

# Result: Production-ready feature in minutes
```

**2. Epic Planning**
```bash
# Issue #100: User Authentication System
agentx collaborate 100 --agents pm,architect

# PM drafts PRD → Architect reviews → Iterate → Final plan
# Outputs: PRD-100.md + ADR-100.md
```

**3. Bug Fixing**
```bash
# Issue #789: Login returns 500 error
agentx implement 789

# Engineer investigates, fixes, adds regression tests
# Creates PR with fix
```

**4. Design Review**
```bash
# Need UX feedback on feature
agentx design 123

# UX Designer creates wireframes, user flows, accessibility checklist
```

---

## 💰 Cost

**AgentX CLI Tool:** **FREE** (MIT License)

**Usage Costs:**

| Component | Cost | Notes |
|-----------|------|-------|
| GitHub Copilot | $10-39/mo per user | Already paying if using Copilot |
| GitHub Actions | Free tier: 2,000 min/mo | ~400 agent runs/mo |
| **AgentX** | **$0** | **Completely free** |

**No hidden costs:**
- ❌ No hosting fees
- ❌ No database costs
- ❌ No infrastructure
- ❌ No per-seat licensing
- ✅ Just install and use

**Example:** Team of 5 developers, 50 agent executions/week:
- AgentX: $0
- Copilot: $195/mo (already paying)
- GitHub Actions: Free tier (200 executions = 1,000 min < 2,000 free)
- **Total additional cost: $0**

---

## 🏗️ Architecture

### CLI Tool + GitHub Actions

```
Developer Machine                  GitHub
─────────────────                  ──────
                                   
agentx create-prd 123 ────────┐   
                              │   
pip install agentx-cli        │   
                              ▼   
                           GitHub Issue #123
                                   │
                                   │ Label: type:feature
                                   ▼
                           GitHub Actions Workflow
                                   │
                                   │ Install: pip install agentx-cli
                                   │ Execute: agentx create-prd 123
                                   ▼
                           Copilot SDK (in runner)
                                   │
                                   │ Uses skills, templates, tools
                                   ▼
                           Output: docs/prd/PRD-123.md
                                   │
                                   │ git commit && git push
                                   ▼
                           PR or commit to repo
```

**Key Points:**
- Runs locally OR in GitHub Actions
- No hosted service needed
- No Docker containers
- Zero infrastructure costs

**See:** [Architecture Revision](docs/ARCHITECTURE-REVISION.md) for design rationale

**3-Layer Model** for optimal performance:

| Layer | Technology | Speed | Purpose |
|-------|------------|-------|---------|
| **Layer 1** | GraphQL API | 2s | Fast operations (labels, comments, assignments) |
| **Layer 2** | GitHub Actions | 10-60s | Agent execution (PM, Architect, UX, Engineer, Reviewer) |
| **Layer 3** | MCP Server | <1s | Coordination & workflow triggers |

**Performance Improvements:**
- ⚡ **9x faster handoffs** (45s → 5s)
- ⚡ **15x faster assignments** (30s → 2s)
- ⚡ **5x faster label updates** (5s → 1s)

**Key Features:**
- Direct API access (no caching delays)
- Structured JSON responses
- Agent-native design
- Parallel GraphQL operations

See [MCP Integration Guide](docs/mcp-integration.md) for setup details.

### 🔒 4-Layer Security Architecture

Built on "Policy over Approval" philosophy - configure once, trust the guardrails.

```
┌─────────────────────────────────────────────────────────────────┐
│         AgentX: 4-Layer Security Architecture                   │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: Actor Allowlist (CODEOWNERS)                          │
│  ├── ✅ @github-actions[bot] → Authorized for auto-merge        │
│  ├── ✅ @jnPiyush → Authorized for auto-merge                   │
│  └── ❌ Unknown actors → Requires manual review                 │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Protected Paths (agentx-security.yml)                 │
│  ├── 🔒 .github/workflows/** → Human review required            │
│  ├── 🔒 package.json, *.csproj → Human review required          │
│  └── ✅ docs/**, samples/** → Auto-merge allowed                │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Kill Switch (agentx-security.yml)                     │
│  ├── enabled: false → Disable all auto-merge instantly          │
│  └── enabled: true  → Resume autonomous operations              │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: Audit Trail                                           │
│  ├── PR comments documenting security check results             │
│  ├── GitHub Actions logs for every decision                     │
│  └── Issue comments tracking agent handoffs                     │
└─────────────────────────────────────────────────────────────────┘
```

Plus client-side protection: VS Code YOLO settings auto-approve safe commands (`git commit`, `npm test`) while blocking destructive ones (`rm -rf`, `git reset --hard`).

### 📋 Task Management

- GitHub Issues as persistent, distributed memory
- Label taxonomy for task hierarchy (epic → feature → story → task)
- Session state preservation across context windows
- Multi-agent coordination with file lock labels

### 🧪 Automated Testing

- **E2E Test Suite**: 5 comprehensive test suites validating orchestration
- **Coverage**: >85% of orchestration paths
- **Automated**: Daily at 2 AM UTC + manual trigger
- **Test Categories**: Smoke tests, orchestration flow, event-driven triggers, metrics, summary

See [E2E Test Documentation](tests/e2e/README.md) for details.

### 📚 18 Production Skills

| Category | Skills |
|----------|--------|
| **Foundation** | Core Principles, Testing, Error Handling, Security |
| **Architecture** | Performance, Database, Scalability, Code Organization, API Design |
| **Development** | Configuration, Documentation, Version Control, Type Safety, Dependencies, Logging |
| **Operations** | Remote Git Ops, Code Review & Audit |
| **AI Systems** | AI Agent Development |

---

## 📁 Repository Structure

```
AgentX/
├── README.md                      # This file
├── AGENTS.md                      # Agent behavior, workflows (350 lines, optimized)
├── Skills.md                      # Technical standards index
├── install.ps1                    # PowerShell install script (Windows)
├── install.sh                     # Bash install script (macOS/Linux)
│
├── docs/
│   ├── mcp-integration.md         # GitHub MCP Server documentation
│   ├── project-setup.md           # Project setup guide
│   ├── architecture-hybrid-orchestration.md # 3-layer architecture
│   └── technical-specification.md # Complete system specification
│
└── .github/
    ├── copilot-instructions.md    # Global Copilot configuration
    ├── orchestration-config.yml   # Multi-agent orchestration config
    │
    ├── agents/                    # Agent role definitions (5 agents, 7-section structure)
    │   ├── product-manager.agent.md   # PRD & backlog creation
    │   ├── architect.agent.md         # ADR & tech specs
    │   ├── ux-designer.agent.md       # Wireframes & user flows
    │   ├── engineer.agent.md          # Implementation & tests
    │   └── reviewer.agent.md          # Code review & security
    │
    ├── workflows/                 # GitHub Actions orchestration
    │   ├── agent-orchestrator.yml     # Unified hybrid orchestration (all agents)
    │   ├── test-e2e.yml               # E2E testing workflow
    │   └── quality-gates.yml          # Quality validation
    │
    ├── skills/                    # 18 production skills (SKILL.md format)
    │   ├── core-principles/
    │   ├── testing/
    │   ├── security/
    │   ├── ai-agent-development/
    │   └── ...
    │
    ├── instructions/              # Language-specific rules
    │   ├── csharp.instructions.md
    │   ├── python.instructions.md
    │   ├── react.instructions.md
    │   └── api.instructions.md
    │
    └── prompts/                   # Reusable prompt templates
        ├── code-review.prompt.md
        ├── refactor.prompt.md
        └── test-gen.prompt.md
```

---

## 📦 Installation

### Option 1: One-Line Install Scripts (Recommended)

**PowerShell (Windows):**
```powershell
irm https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.ps1 | iex
```

**Bash (macOS/Linux):**
```bash
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash
```

**What It Installs:**
- Core docs (`AGENTS.md`, `Skills.md`, `CONTRIBUTING.md`)
- Issue templates (Epic, Feature, Story, Bug, Spike, Docs)
- PR template with checklist
- Pre-commit hooks (validate issues, check security)
- Git hooks for commit message validation
- GitHub Actions workflows (issue enforcement, orchestration)

> **No GitHub Copilot Required!** Works standalone via templates and hooks.

### Option 2: Manual Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/jnPiyush/AgentX.git
   ```

2. Copy files to your project:
   ```bash
   cp -r AgentX/AGENTS.md AgentX/Skills.md AgentX/skills your-project/
   cp -r AgentX/.github your-project/
   cp -r AgentX/.vscode your-project/  # Optional: VS Code settings
   ```

### Option 3: GitHub Template

Use AgentX as a template when creating a new repository:
1. Go to [github.com/jnPiyush/AgentX](https://github.com/jnPiyush/AgentX)
2. Click "Use this template"
3. Create your new repository

---

## 🚀 Getting Started

### Prerequisites

| Tool | Purpose | Required? | Installation |
|------|---------|-----------|--------------|
| **Git** | Version control | ✅ Yes | [git-scm.com](https://git-scm.com) |
| **GitHub CLI** | Issue/PR management | ✅ Yes | `winget install GitHub.cli` |
| **GitHub Projects** | Status tracking | ✅ Yes | Create via GitHub UI with Status field |
| **VS Code** | Editor | Recommended | [code.visualstudio.com](https://code.visualstudio.com) |
| **GitHub Copilot** | AI coding assistant | Optional | [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) |

### Quick Setup

```bash
# 1. Clone your project (or create new one)
git clone https://github.com/your-username/your-project.git
cd your-project

# 2. Install AgentX
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash

# 3. Authenticate GitHub CLI
gh auth login

# 4. Validate setup
./validate.sh  # or validate.ps1 on Windows
```

**That's it!** The workflow is now enforced via templates, hooks, and GitHub Actions.

---

## 📖 Usage Guide

### Without GitHub Copilot (Manual Workflow)

**Follow this guide**: [CONTRIBUTING.md](CONTRIBUTING.md)

**Quick workflow:**
```bash
# 1. Create issue (choose template)
gh issue create --web

# 2. Claim issue (move to 'In Progress' in Projects board)
gh issue comment 123 --body "Starting work on this"

# 3. Work on code
# (Pre-commit hooks validate security/format)

# 4. Commit with issue reference
git commit -m "feat: add feature (#123)"

# 5. Create PR (template enforces checklist)
gh pr create --fill

# 6. After merge, close issue
gh issue close 123
```

### With GitHub Copilot (AI-Assisted)

When working in this repository, Copilot will automatically:
- Guide you through the Issue-First workflow
- Enforce security best practices
- Generate tests with ≥80% coverage
- Apply coding standards from Skills.md
- Create documentation

**Just ask Copilot**: "Create a feature for X" and it handles the workflow.

---

## 🛡️ Enforcement Without Copilot

AgentX enforces workflows at **multiple levels**:

### 1. GitHub Issue Templates
Structured forms for creating issues (Epic, Feature, Story, Bug, Spike, Docs). Forces proper categorization and context.

### 2. PR Template
Checklist ensures:
- Issue reference (not retroactive)
- Tests written (≥80% coverage)
- Security checks passed
- Documentation updated

### 3. Pre-Commit Hooks
**Installed automatically** during setup. Validates:
- Commit messages reference issues
- No secrets in code
- Code formatting
- SQL injection patterns

```bash
# Manually install hooks
cp .github/hooks/* .git/hooks/
chmod +x .git/hooks/pre-commit .git/hooks/commit-msg
```

### 4. GitHub Actions
Runs on every push/PR:
- [agent-orchestrator.yml](.github/workflows/agent-orchestrator.yml) - Hybrid 3-layer orchestration (GraphQL + Workflows + MCP)
- [test-e2e.yml](.github/workflows/test-e2e.yml) - E2E testing with orchestration validation

### 5. Validation Script
Check compliance at any time:
```bash
./validate.sh      # Linux/Mac
.\validate.ps1     # Windows
```

Checks:
- Git hooks installed
- Required files present
- GitHub labels configured
- Recent commits follow format
- CI/CD workflows active

---

## 📖 Key Documents

| Document | Purpose | Read When |
|----------|---------|-----------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | **Start here** for manual workflow | Setting up without Copilot |
| [AGENTS.md](AGENTS.md) | Agent behavior & workflows (optimized, 350 lines) | Using with Copilot |
| [Skills.md](Skills.md) | Technical standards index (18 skills) | Before coding |
| [docs/mcp-integration.md](docs/mcp-integration.md) | GitHub MCP Server setup | Advanced automation |
| [docs/architecture-hybrid-orchestration.md](docs/architecture-hybrid-orchestration.md) | 3-layer architecture details | Understanding system design |

---

## 🤖 Multi-Agent Orchestration

#### Adopting AgentX in Your Project

**Quick Start (Recommended):**
```bash
cd your-project
# Use one-line install script
curl -fsSL https://raw.githubusercontent.com/jnPiyush/AgentX/master/install.sh | bash
```

**Setup Steps:**
1. **Install** using one of the methods above
2. **Customize** `.github/agentx-security.yml` for your security needs
3. **Update** instruction files for your tech stack
4. **Create labels** in your GitHub repository:

```bash
# Issue type labels
gh label create "type:epic" --description "Large initiative" --color "8B4789"
gh label create "type:feature" --description "User-facing capability" --color "0366D6"
gh label create "type:story" --description "User story" --color "1D76DB"
gh label create "type:bug" --description "Defect to fix" --color "D73A4A"
gh label create "type:spike" --description "Research/investigation" --color "8B4789"
gh label create "type:docs" --description "Documentation only" --color "0075CA"

# Priority labels
gh label create "priority:p0" --description "Critical" --color "B60205"
gh label create "priority:p1" --description "High priority" --color "D93F0B"
gh label create "priority:p2" --description "Medium priority" --color "FBCA04"
gh label create "priority:p3" --description "Low priority" --color "FEF2C0"

# Orchestration labels
gh label create "orch:pm-done" --description "PM work complete" --color "0E8A16"
gh label create "orch:architect-done" --description "Architect work complete" --color "0E8A16"
gh label create "orch:ux-done" --description "UX work complete" --color "0E8A16"
gh label create "orch:engineer-done" --description "Engineer work complete" --color "0E8A16"

# Workflow labels
gh label create "needs:ux" --description "Requires UX design" --color "D876E3"
gh label create "needs:help" --description "Blocked - needs assistance" --color "FF6B6B"
gh label create "needs:changes" --description "Changes requested" --color "FFA500"
```

**Status Tracking**: Use **GitHub Projects Status field** (Backlog, In Progress, In Review, Done), not custom labels.

---

## 🔧 Configuration

### Security Configuration

Edit `.github/agentx-security.yml`:

```yaml
autonomous_mode_enabled: true  # Kill switch - set to false to halt all autonomy

protected_paths:
  - ".github/workflows/**"  # CI/CD pipelines
  - "**/secrets.*"          # Secrets files
  - "**/*.env*"             # Environment config

allowed_actors:
  - "github-actions[bot]"
  - "your-github-username"
  - "your-username"

iteration_limits:
  task: 15
  bugfix: 5
  test_retry: 3
```

### Language Instructions

Create custom instruction files in `.github/instructions/`:

```yaml
---
description: 'Your language coding standards'
applyTo: '**.ext'  # Glob pattern for file matching
---

# Instructions content
[Your language-specific rules]
```

---

## 📊 Architecture Overview

### Hybrid Orchestration Model

AgentX uses a **3-layer hybrid architecture** for optimal performance:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Hybrid Orchestration Model                   │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: GraphQL API (2s operations)                           │
│  ├── Fast label updates (orch:pm-done, orch:architect-done)    │
│  ├── Quick issue assignments                                    │
│  └── Immediate comment posting                                  │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: GitHub Actions Workflows (10-60s operations)          │
│  ├── Agent execution (PM, Architect, UX, Engineer, Reviewer)   │
│  ├── Code generation and testing                               │
│  └── Document creation (PRD, ADR, Spec, Reviews)               │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: MCP Server (<1s operations)                           │
│  ├── Workflow coordination and triggering                       │
│  ├── Direct GitHub API access (no caching)                     │
│  └── Agent-to-agent handoff management                         │
└─────────────────────────────────────────────────────────────────┘
```

**Performance Metrics:**
- 9x faster handoffs (45s → 5s)
- 15x faster assignments (30s → 2s)  
- 5x faster label updates (5s → 1s)

See [Architecture Decision Doc](docs/architecture-decision-hybrid-orchestration.md) for full details.

---

## 📊 Quick Reference

### GitHub CLI Commands

```bash
# Session Start
git pull --rebase
gh issue list --label "type:story,priority:p0"

# Claim Work (move to 'In Progress' in Projects board UI)
gh issue comment <ID> --body "Starting work on this issue"

# Progress Update
gh issue comment <ID> --body "Progress: [description]"

# Complete Work
git commit -m "feat: Description (#ID)"
gh issue close <ID> --comment "Completed in commit <SHA>"
```

**Status Tracking**: Use GitHub Projects board to drag issues between status columns (Backlog → In Progress → In Review → Done)

### Label Hierarchy

**Issue Type & Priority Labels:**
| Label | Purpose |
|-------|---------||
| `type:epic` | Large initiative (multiple features) |
| `type:feature` | User-facing capability |
| `type:story` | User story within a feature |
| `type:bug` | Defect to fix |
| `type:spike` | Research/investigation |
| `type:docs` | Documentation only |
| `priority:p0` | Critical - do immediately |
| `priority:p1` | High - do next |
| `priority:p2` | Medium |
| `priority:p3` | Low |

**Orchestration Labels (Multi-Agent Workflow):**
| Label | Purpose |
|-------|---------|
| `type:epic` | Large initiative - triggers Product Manager |
| `needs:ux` | Requires UX design - triggers UX Designer first |
| `orch:pm-done` | Product Manager work complete |
| `orch:architect-done` | Architect work complete |
| `orch:ux-done` | UX Designer work complete |
| `orch:engineer-done` | Engineer work complete |

### YOLO Mode Activation

Say one of these to enable fully autonomous execution:
- "YOLO"
- "go YOLO"
- "YOLO mode"
- "execute without stopping"

**Exit**: Say "stop", "pause", or "exit YOLO"

---

## 🛡️ Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│              4-Layer Security Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: Actor Allowlist    → Who can auto-merge?              │
│  Layer 2: Protected Paths    → What files need human review?    │
│  Layer 3: Kill Switch        → Emergency stop all autonomy      │
│  Layer 4: Audit Trail        → GitHub Issues for all decisions  │
└─────────────────────────────────────────────────────────────────┘
```

### Blocked Commands (Never Auto-Execute)

```bash
rm -rf, rm -r              # Destructive file operations
git reset --hard           # Destructive git operations
drop database              # Database destruction
curl | bash                # Remote code execution
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [AGENTS.md](AGENTS.md) | Agent behavior, workflows (optimized 350 lines with TOC) |
| [Skills.md](Skills.md) | Technical standards index (18 production skills) |
| [MCP Integration](docs/mcp-integration.md) | GitHub MCP Server setup (remote + local options) |
| [Architecture](docs/architecture-hybrid-orchestration.md) | 3-layer hybrid orchestration model |
| [Technical Specification](docs/technical-specification.md) | Complete system architecture and design |
| [Project Setup](docs/project-setup.md) | GitHub Projects configuration guide |
| [E2E Testing](tests/e2e/README.md) | Orchestration testing and validation |
| [.github/skills/](https://github.com/jnPiyush/AgentX/tree/master/.github/skills) | Detailed documentation for each of 18 skills |

### Standards

- **awesome-copilot**: [github.com/github/awesome-copilot](https://github.com/github/awesome-copilot)
- **agentskills.io**: [agentskills.io/specification](https://agentskills.io/specification)

---

## 🧪 Verification

This system has been E2E tested and verified:

| Component | Status |
|-----------|--------|
| Memory Management (Layer 1-3) | ✅ Verified |
| State Management | ✅ Verified |
| GitHub Issues Task Management | ✅ Verified |
| Multi-Agent Workflow | ✅ Verified |
| Label System | ✅ 15+ custom labels (type:*, priority:*, orch:*, needs:*) |

See [Technical Specification - Section 11](docs/technical-specification.md#11-implementation-verification) for full test results.

---

## 🤝 Contributing

1. **Create an issue** describing your proposed change
2. **Fork** the repository
3. **Create a branch** for your feature
4. **Follow** the guidelines in [AGENTS.md](AGENTS.md)
5. **Submit** a pull request referencing the issue

---

## 📄 License

This project is open source. See individual files for specific licensing.

---

## 🔗 Links

- **awesome-copilot**: [github.com/github/awesome-copilot](https://github.com/github/awesome-copilot)
- **agentskills.io**: [agentskills.io](https://agentskills.io)

---

**Last Updated**: January 21, 2026

---

## ✅ Verified Components

All system components have been comprehensively tested:

| Component | Status | Details |
|-----------|--------|---------|--------|
| **Workflows** | ✅ Tested | agent-orchestrator.yml, test-e2e.yml, quality-gates.yml |
| **Agent Definitions** | ✅ Tested | 5 agents with 7-section structure (Role → Workflow → Execution → Tools → Handoff → Enforcement → References) |
| **Skills** | ✅ Tested | All 18 skills with proper structure and content |
| **Instructions** | ✅ Tested | C#, Python, React, API language-specific guidance |
| **MCP Integration** | ✅ Tested | Configuration and documentation validated |
| **Issue Templates** | ✅ Tested | 6 templates (epic, feature, story, bug, spike, docs) |
| **Orchestration Config** | ✅ Tested | All agent roles defined |
| **Documentation** | ✅ Tested | AGENTS.md optimized (66% reduction), all cross-references validated |
| **Workflow References** | ✅ Fixed | All references use `agent-orchestrator.yml` (no obsolete workflow files) |

