# AgentX vs HVE Core — Comparison Report

**Date**: February 13, 2026  
**AgentX Version**: v5.1.0 | **HVE Core Version**: v2.2.0  
**Purpose**: Side-by-side comparison of two GitHub Copilot prompt engineering frameworks

---

## Executive Summary

Both frameworks extend GitHub Copilot with structured agents, instructions, and prompts. They share the same VS Code artifact types but serve different philosophies:

| | **AgentX** | **HVE Core** |
|---|---|---|
| **Publisher** | jnPiyush (individual) | Microsoft ISE (19 contributors) |
| **Stars** | New | 100 |
| **Philosophy** | Production guardrails + full SDLC process | Constraint-based RPI methodology |
| **Tagline** | "AI Agent Orchestration Framework" | "Hypervelocity Engineering Prompt Library" |
| **Target** | Teams building any app (including AI agents) | Teams adopting structured AI-assisted engineering |

---

## Component Inventory

| Component | AgentX | HVE Core | Winner |
|-----------|--------|----------|--------|
| **Skills** | 41 | 1 | **AgentX** (41x) |
| **Instruction files** | 12 | 17+ | **HVE Core** |
| **Agents** | 8 | 18 | **HVE Core** (quantity) |
| **Prompts** | 11 | 18 | **HVE Core** |
| **Templates** | 7 (+ 1 lite variant) | 3 (ADR, BRD, Security Plan) | **AgentX** |
| **Executable scripts** | 30 | ~5 (linting/security) | **AgentX** (6x) |
| **JSON schemas** | 3 | 4 | **HVE Core** |
| **CI/CD workflows** | 4 | 5+ | **HVE Core** |
| **CLI** | 11 subcommands | None | **AgentX** |
| **VS Code Extension** | No | Yes (Marketplace) | **HVE Core** |
| **TOML workflows** | 7 | None | **AgentX** |
| **Self-tests** | 80 assertions | Pester tests (~100+) | Comparable |

---

## Detailed Analysis

### 1. Agent Architecture

| Aspect | AgentX | HVE Core |
|--------|--------|----------|
| **Pattern** | Hub-and-spoke (Agent X routes) | Peer-based (user picks phase) |
| **Count** | 8 agents | 18 agents |
| **Roles** | PM, UX, Architect, Engineer, Reviewer, DevOps, Agent X, Auto-Fix | Task Researcher, Task Planner, Task Implementor, Task Reviewer, RPI Agent, PR Review, Backlog Manager, BRD Builder, Prompt Builder, ADO agents, Installer + 7 more |
| **SDLC coverage** | Full (PM → UX → Architecture → Code → Review) | Dev-focused (Research → Plan → Implement → Review) |
| **Handoffs** | Frontmatter `handoffs:` with labels | Frontmatter `handoffs:` with prompts |
| **Routing** | Centralized (Agent X auto-classifies) | Manual (user selects phase agent) |
| **Maturity levels** | stable, preview, experimental, deprecated | stable, preview, experimental, deprecated |

**Analysis**: AgentX covers the **full software lifecycle** (product → design → architecture → code → review). HVE Core covers the **engineering task lifecycle** (research → plan → implement → review). HVE Core has roles AgentX lacks (BRD Builder, ADO integration). AgentX has roles HVE Core lacks (PM, UX Designer, Solution Architect, DevOps Engineer).

### 2. Instruction Files

| Aspect | AgentX (12 files) | HVE Core (17+ files) |
|--------|-------------------|----------------------|
| **Languages** | C#, Python, TypeScript, React, Blazor | C#, Python, Bash, PowerShell |
| **IaC** | Terraform, Bicep | Terraform (via instructions) |
| **Config** | YAML, SQL | Markdown, YAML |
| **Workflows** | DevOps, AI, API | Commit Messages, PR, ADO work items |
| **Auto-loading** | `applyTo` glob | `applyTo` glob |
| **RFC 2119** | Yes (documented in router) | Yes (enforced in all artifacts) |
| **Schema validation** | JSON schema (3 schemas) | JSON schema (4 schemas) |

**Analysis**: Both have auto-loading instructions. AgentX covers more **application languages** (React, Blazor, TypeScript backend). HVE Core covers more **workflow-specific** instructions (commit messages, PR creation, ADO integration). Both validate frontmatter with JSON schemas.

### 3. Skills (Biggest Differentiator)

| Aspect | AgentX | HVE Core |
|--------|--------|----------|
| **Count** | 41 skills | 1 skill |
| **Categories** | Architecture (7), Development (20), Operations (4), Cloud (5), AI Systems (4), Design (1) | Dev-tools (1) |
| **Executable scripts** | 30 (scaffold, scan, validate, benchmark) | Limited |
| **Specification** | agentskills.io compliant | Custom |
| **Progressive disclosure** | 3-tier (metadata → body → references) | Not applicable |
| **Code generation** | `scaffold-agent.py`, `scaffold-cognitive.py`, `scaffold-project.py`, `scaffold-solution.ps1`, `scaffold-openapi.py`, `scaffold-playwright.py` | None |
| **Security scanning** | `scan-secrets.ps1/sh`, `scan-security.ps1` | `Test-DependencyPinning.ps1` |
| **Coverage enforcement** | `check-coverage.ps1/sh`, `check-test-pyramid.ps1` | None |
| **Model evaluation** | `run-model-comparison.py`, `check-model-drift.ps1` | None |

**Analysis**: This is **AgentX's strongest advantage**. 41 production-grade skills with 30 executable scripts that generate real code, scan for vulnerabilities, and enforce quality gates. HVE Core has 1 skill focused on dev-tools. A team using AgentX gets scaffolding, security scanning, and coverage enforcement out of the box. HVE Core teams must bring their own.

### 4. Workflow Methodology

| Aspect | AgentX | HVE Core |
|--------|--------|----------|
| **Core method** | Issue-First + Hub-and-Spoke + TOML workflows | RPI (Research → Plan → Implement → Review) |
| **Workflow types** | 7 TOML templates (epic, feature, story, bug, spike, devops, docs) | 4 RPI phases (research, plan, implement, review) |
| **Enforcement** | CLI + status machine + pre-commit hooks | Documentation-driven (no tooling enforcement) |
| **CLI** | `agentx.ps1/sh` — ready, state, deps, workflow, hook, version, run | None |
| **Status tracking** | GitHub Projects V2 or Local Mode JSON | Not built-in |
| **Dependency management** | `Blocked-by: #10` / `Blocks: #15` conventions + CLI check | Not built-in |
| **Local/offline mode** | Yes (filesystem-based issue tracking) | No |
| **Context clearing** | Documented between phase transitions | "Always `/clear` between phases" |

**Analysis**: AgentX has **tooling-enforced** process discipline (CLI checks prerequisites before handoffs, TOML workflows define steps declaratively). HVE Core's RPI methodology is **documentation-driven** — elegant in theory but relies on user discipline. AgentX's CLI gives you `agentx.ps1 ready` to find unblocked work; HVE Core has no equivalent.

### 5. Security & Quality

| Aspect | AgentX | HVE Core |
|--------|--------|----------|
| **Command allowlist** | `allowed-commands.json` (4-layer defense) | No |
| **Secrets scanning** | `scan-secrets.ps1/sh` + `scan-security.ps1` | No dedicated scripts |
| **Dependency scanning** | `audit-deps.ps1` + GH Action workflow | `Test-DependencyPinning.ps1` (SHA pinning) |
| **Test coverage** | 80% enforced via `check-coverage.ps1/sh` | Not enforced |
| **Test pyramid** | 70/20/10 enforced via `check-test-pyramid.ps1` | Not enforced |
| **Pre-commit hooks** | `pre-commit` + `commit-msg` | No |
| **Frontmatter validation** | `validate-frontmatter.ps1` (130 checks, 0 errors) | `npm run lint:frontmatter` (JSON schema) |
| **OpenSSF Scorecard** | Yes (workflow + badge) | Yes (workflow + badge) |
| **CodeQL** | No | Yes |
| **Self-tests** | 80 assertions (PowerShell) | Pester tests (~1700+ lines) |

**Analysis**: Different strengths. AgentX excels at **code-level** quality (secrets, SQL injection, test coverage, test pyramid). HVE Core excels at **supply-chain** quality (CodeQL, dependency SHA pinning, more rigorous frontmatter validation with JSON schemas and Pester tests).

### 6. Installation & Distribution

| Aspect | AgentX | HVE Core |
|--------|--------|----------|
| **Primary method** | `install.ps1/sh` (one-liner) | VS Code Extension (Marketplace) |
| **Default mode** | Local (zero prompts, no GitHub required) | N/A (extension includes everything) |
| **Zero-config** | Yes — `irm .../install.ps1 \| iex` (zero prompts) | Yes (install extension, done) |
| **GitHub mode** | Opt-in via `-Mode github` (asks repo/project) | N/A |
| **Installation methods** | Script install (2 OS variants), env var overrides | Extension, Multi-root, Submodule, Peer clone, Git-ignored, Mounted, Codespaces (7 methods) |
| **Installer agent** | No | `hve-core-installer` agent |
| **Extension channels** | No | Stable + Pre-release |
| **Offline/local support** | Yes — local mode works without GitHub | No |
| **File embedding** | Copies into project | References via VS Code settings paths |

**Analysis**: Both now offer **zero-config** installation. AgentX's one-liner (`irm .../install.ps1 | iex`) defaults to local mode with zero prompts — no questions asked. GitHub mode is opt-in via `-Mode github`. HVE Core's VS Code extension is equally frictionless. HVE Core still has more installation methods (Codespaces, devcontainer, submodule, etc.), but AgentX's local-first default gives it an edge for solo developers and offline use.

### 7. Templates & Documentation

| Aspect | AgentX | HVE Core |
|--------|--------|----------|
| **Templates** | PRD, ADR, Spec (Full + Lite), UX, Review, Progress (7+1) | ADR, BRD, Security Plan (3) |
| **Quickstart** | 5-minute tutorial (`docs/QUICKSTART.md`) | 15-minute first workflow (`docs/getting-started/first-workflow.md`) |
| **Contributing guides** | `CONTRIBUTING.md` (1 file) | `docs/contributing/` (6 specialized guides) |
| **Architecture docs** | In `AGENTS.md` | `docs/architecture/` (dedicated folder) |
| **RPI/methodology docs** | Process described in AGENTS.md | `docs/rpi/` (dedicated folder with 6 deep-dive docs) |
| **Input variables** | `${variable}` syntax | `${input:variableName}` with VS Code integration |

**Analysis**: AgentX has broader **template coverage** (PRD, UX, Review, Spec-Lite). HVE Core has deeper **contributing documentation** (6 guides for agent/prompt/instruction/skill authoring) and a more thoroughly documented methodology (RPI gets its own folder with 6 guides).

---

## Scoring Matrix

| Category | AgentX | HVE Core | Notes |
|----------|--------|----------|-------|
| **Skills & Scaffolding** | 10 | 2 | AgentX: 41 skills, 30 scripts. HVE Core: 1 skill. |
| **Agent Design** | 8 | 9 | HVE Core: more agents, cleaner phase model. AgentX: full SDLC. |
| **Instruction Coverage** | 9 | 9 | Tie — different focus (app vs infrastructure). |
| **Workflow Tooling** | 10 | 5 | AgentX: CLI, TOML, status tracking. HVE Core: none. |
| **Security & Quality** | 9 | 8 | AgentX: code-level. HVE Core: supply-chain. |
| **Distribution** | 8 | 10 | HVE Core: VS Code extension, 7 methods. AgentX: zero-prompt one-liner + local-first. |
| **Documentation** | 8 | 9 | HVE Core: deeper contributing guides, RPI methodology. |
| **Process Discipline** | 10 | 7 | AgentX: enforced via CLI/hooks. HVE Core: documentation-driven. |
| **Enterprise Credibility** | 7 | 10 | HVE Core: Microsoft, OpenSSF, 19 contributors. |
| **AI-Specific Features** | 10 | 4 | AgentX: RAG, Memory, model drift, evaluation, scaffolding. |
| **Template Library** | 9 | 6 | AgentX: 8 templates. HVE Core: 3 templates. |
| **Overall** | **8.9/10** | **7.2/10** | AgentX stronger on tooling; HVE Core stronger on polish. |

---

## Where Each Framework Wins

### AgentX Wins On

1. **Skills library** — 41 vs 1 (41x advantage)
2. **Code generation** — 6 scaffold scripts that produce real projects
3. **Full SDLC coverage** — PM, UX, Architect roles HVE Core doesn't have
4. **CLI tooling** — 11 subcommands for workflow management
5. **AI agent development** — RAG, Memory, model drift, evaluation, cognitive architecture
6. **Quality enforcement** — Test coverage, test pyramid, security scans
7. **Process discipline** — TOML workflows, status machine, dependency tracking
8. **Template library** — PRD, ADR, Spec (2 variants), UX, Review, Progress
9. **Zero-prompt install** — Local mode default with one-liner, no questions asked

### HVE Core Wins On

1. **VS Code Extension** — Marketplace distribution with multiple install methods
2. **RPI Methodology** — Formally documented constraint-based psychology
3. **Contributing documentation** — 6 specialized authoring guides
4. **Installation flexibility** — 7 methods (Codespaces, devcontainer, submodule, etc.)
5. **Enterprise credibility** — Microsoft, 19 contributors, OpenSSF badge
6. **CodeQL integration** — Automated vulnerability detection
7. **Prompt quantity** — 18 prompts (task-oriented + ADO integration)
8. **Agent quantity** — 18 agents (deeper task decomposition)

---

## Complementary Strengths

The frameworks are **not competitors** — they target different layers:

```
┌─────────────────────────────────────────────────────────┐
│  HVE Core Layer (Methodology + Distribution)            │
│  • RPI workflow discipline                              │
│  • VS Code extension distribution                      │
│  • Enterprise validation pipeline                       │
│  • Contributing standards                               │
├─────────────────────────────────────────────────────────┤
│  AgentX Layer (Skills + Tooling + Process)              │
│  • 41 production skills with 30 scripts                 │
│  • Full SDLC agents (PM → UX → Arch → Eng → Review)   │
│  • CLI with workflow automation                         │
│  • AI cognitive architecture (RAG, Memory, Evaluation)  │
│  • Security scanning and quality enforcement            │
└─────────────────────────────────────────────────────────┘
```

A team could theoretically **use both**: HVE Core's RPI methodology for task execution + AgentX's skills library for code standards and scaffolding.

---

## AgentX Roadmap (Inspired by HVE Core Strengths)

| Item | Status | Gap Closed |
|------|--------|-----------|
| ~~JSON schema validation~~ | **Done** — 3 schemas + `validate-frontmatter.ps1` | Enterprise validation |
| ~~OpenSSF Scorecard~~ | **Done** — workflow + badge | Enterprise credibility |
| ~~RFC 2119 directives~~ | **Done** — documented in router | Formal quality standard |
| ~~Terraform/Bicep/YAML instructions~~ | **Done** — 3 new instruction files | IaC coverage parity |
| ~~Zero-prompt install~~ | **Done** — local default, no prompts | Frictionless onboarding |
| VS Code Extension packaging | **Backlog** | Marketplace distribution |
| CodeQL workflow | **Backlog** | Supply-chain security |
| More installation methods (Codespaces) | **Backlog** | Developer experience |
| Contributing authoring guides | **Backlog** | Contributor onboarding |

---

*Report generated February 13, 2026. AgentX v5.1.0 vs HVE Core v2.2.0.*
