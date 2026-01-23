# ADR: GitHub Copilot SDK as CLI Tool

> **Status**: Proposed  
> **Date**: January 22, 2026  
> **Decision Makers**: Engineering Team  
> **Architecture**: Installable CLI Tool (Not Hosted Service)

---

## Context

AgentX currently uses:
- GitHub Actions for orchestration
- GraphQL for fast GitHub operations
- MCP Server for coordination
- Manual agent execution via workflows

**Problem:** Teams want AI-powered agents but don't want to:
- Host services
- Manage infrastructure
- Pay hosting costs
- Deal with Docker/containers

**Solution Needed:** Quick-start tool that **installs in minutes** in any project (new or existing) to expedite:
- Code development
- Backlog management
- Design creation
- UX development  
- Critical thinking

---

## Decision

**We will create AgentX as an installable Python CLI tool** that brings AI agents to any project without hosting requirements.

### Architecture: Local CLI Tool + GitHub Actions

```
┌──────────────────────────────────────────────────────────────┐
│                    Your Project Repository                    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Install: pip install agentx-cli                   │   │
│  │ 2. Initialize: agentx init                           │   │
│  │ 3. Use: agentx create-prd 123                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  .github/                                                     │
│  ├─ workflows/         (Auto-generated GitHub Actions)       │
│  ├─ agents/            (Agent definitions)                    │
│  ├─ skills/            (Production skills)                    │
│  └─ templates/         (PRD, ADR, Spec templates)            │
│                                                               │
│  agentx.yaml           (Project configuration)                │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Execution Modes                                               │
├──────────────────────────────────────────────────────────────┤
│ Local CLI:  agentx create-prd 123                           │
│             → Runs SDK locally, outputs to docs/              │
├──────────────────────────────────────────────────────────────┤
│ GitHub Actions: Push/PR triggers workflows                    │
│                 → Runs SDK in Actions runner                  │
├──────────────────────────────────────────────────────────────┤
│ VS Code: GitHub Copilot Chat integration                      │
│          → "@agentx create feature for issue 123"             │
└──────────────────────────────────────────────────────────────┘
```

---

## Design

### 1. CLI Tool Package

**Package Name:** `agentx-cli`  
**Install:** `pip install agentx-cli`  
**Language:** Python 3.11+

**Project Structure:**
```
agentx/                       # Python package
├─ __init__.py
├─ cli.py                     # Click CLI commands
├─ core/
│  ├─ agent_executor.py       # SDK agent execution
│  ├─ config_loader.py        # Load agentx.yaml
│  └─ project_init.py         # Initialize new projects
├─ agents/
│  ├─ pm.py                   # Product Manager agent
│  ├─ architect.py            # Architect agent
│  ├─ engineer.py             # Engineer agent
│  ├─ ux.py                   # UX Designer agent
│  └─ reviewer.py             # Reviewer agent
├─ tools/
│  ├─ github_tools.py         # Issue/PR via gh CLI or MCP
│  ├─ codebase_tools.py       # Search project files
│  └─ template_tools.py       # Generate docs from templates
├─ templates/
│  ├─ PRD-TEMPLATE.md
│  ├─ ADR-TEMPLATE.md
│  ├─ SPEC-TEMPLATE.md
│  ├─ UX-TEMPLATE.md
│  └─ REVIEW-TEMPLATE.md
├─ workflows/                 # GitHub Actions templates
│  ├─ agent-orchestrator.yml
│  ├─ run-pm.yml
│  └─ run-engineer.yml
└─ skills/                    # 18 production skills
   ├─ testing/SKILL.md
   ├─ security/SKILL.md
   └─ ... (16 more)
```

### 2. CLI Commands

**Core Commands:**

```bash
# Initialize AgentX in project
agentx init

# Create PRD for epic/feature
agentx create-prd <issue_number>

# Create ADR for technical decision
agentx create-adr <issue_number>

# Implement story/feature
agentx implement <issue_number>

# Review code changes
agentx review <pr_number>

# Create UX design
agentx design <issue_number>

# Multi-agent collaboration
agentx collaborate <issue_number> --agents pm,architect

# Run agent in conversation mode
agentx chat --agent engineer

# Validate setup
agentx doctor

# Update AgentX
agentx update
```

### 3. Installation & Setup

**Quick Start (Any Project):**

```bash
# Step 1: Install AgentX
pip install agentx-cli

# Step 2: Initialize in your project
cd /path/to/your-project
agentx init

# This creates:
# ✅ .github/workflows/       (Agent orchestration)
# ✅ .github/agents/          (Agent definitions)
# ✅ .github/skills/          (Production skills)
# ✅ .github/templates/       (Document templates)
# ✅ agentx.yaml             (Configuration)
# ✅ docs/                   (Output directories)

# Step 3: Configure GitHub token
# For local use:
export GITHUB_TOKEN=ghp_xxxx

# For GitHub Actions:
# Already available as secrets.GITHUB_TOKEN

# Step 4: Use it!
agentx create-prd 123
```

### 4. Agent Configuration

**File:** `agentx.yaml` (created by `agentx init`)

```yaml
# AgentX Configuration
version: "1.0"

# Project settings
project:
  name: "YourProject"
  repository: "owner/repo"

# Agent configurations
agents:
  product_manager:
    enabled: true
    model: "gpt-5.1"
    temperature: 0.3
    skills:
      - code-organization
      - documentation
      - api-design
  
  architect:
    enabled: true
    model: "claude-opus-4-5"  # Best for architecture
    temperature: 0.2
    skills:
      - core-principles
      - scalability
      - security
      - performance
  
  engineer:
    enabled: true
    model: "gpt-5.1-codex-max"  # Best for coding
    temperature: 0.1
    skills:
      - testing
      - security
      - error-handling
      - type-safety
  
  ux_designer:
    enabled: true
    model: "gpt-5.1"
    temperature: 0.4
    skills:
      - documentation
      - code-organization
  
  reviewer:
    enabled: true
    model: "gpt-5.1"
    temperature: 0.2
    skills:
      - testing
      - security
      - code-review-and-audit

# Output directories
output:
  prd: "docs/prd"
  adr: "docs/adr"
  specs: "docs/specs"
  ux: "docs/ux"
  reviews: "docs/reviews"

# GitHub integration
github:
  auto_commit: true      # Commit generated files
  create_pr: false       # Don't auto-create PRs
  add_labels: true       # Add orchestration labels
```

### 5. Agent Execution (SDK Integration)

**File:** `agentx/core/agent_executor.py`

```python
"""Agent Execution using Copilot SDK"""
import asyncio
from copilot import CopilotClient, CustomAgentConfig
from pathlib import Path
import yaml

class AgentExecutor:
    """Execute agents using Copilot SDK"""
    
    def __init__(self, config_path: str = "agentx.yaml"):
        self.config = self._load_config(config_path)
        self.client = None
    
    def _load_config(self, path: str) -> dict:
        """Load agentx.yaml configuration"""
        with open(path) as f:
            return yaml.safe_load(f)
    
    async def execute(self, agent_type: str, issue_number: int) -> dict:
        """
        Execute an agent
        
        Args:
            agent_type: pm, architect, engineer, ux, reviewer
            issue_number: GitHub issue number
            
        Returns:
            Result dict with generated files
        """
        # Start SDK client
        self.client = CopilotClient()
        await self.client.start()
        
        try:
            # Load agent configuration
            agent_config = self._get_agent_config(agent_type)
            
            # Create SDK session
            session = await self.client.create_session({
                "model": agent_config["model"],
                "temperature": agent_config["temperature"],
                "custom_agents": [self._build_custom_agent(agent_type)],
                "skill_directories": [".github/skills"],
                "mcp_servers": {
                    "github": {
                        "type": "http",
                        "url": "https://api.githubcopilot.com/mcp/"
                    }
                }
            })
            
            # Execute agent task
            result = await self._execute_task(
                session, agent_type, issue_number
            )
            
            return result
            
        finally:
            if self.client:
                await self.client.stop()
    
    def _get_agent_config(self, agent_type: str) -> dict:
        """Get configuration for agent"""
        return self.config["agents"][agent_type]
    
    def _build_custom_agent(self, agent_type: str) -> CustomAgentConfig:
        """Build SDK CustomAgentConfig"""
        # Load agent prompt from .github/agents/{agent_type}.agent.md
        prompt_file = f".github/agents/{agent_type}.agent.md"
        with open(prompt_file) as f:
            prompt = f.read()
        
        return CustomAgentConfig(
            name=agent_type,
            prompt=prompt,
            tools=self._get_tools_for_agent(agent_type)
        )
    
    def _get_tools_for_agent(self, agent_type: str) -> list:
        """Get SDK tools for agent"""
        from agentx.tools import github_tools, template_tools
        
        tools_map = {
            "pm": [
                template_tools.generate_prd,
                github_tools.create_issue,
                github_tools.add_label
            ],
            "architect": [
                template_tools.generate_adr,
                template_tools.generate_spec,
                github_tools.add_comment
            ],
            "engineer": [
                template_tools.generate_code,
                template_tools.generate_tests,
                github_tools.create_pr
            ]
        }
        
        return tools_map.get(agent_type, [])
    
    async def _execute_task(
        self, session, agent_type: str, issue_number: int
    ) -> dict:
        """Execute agent-specific task"""
        # Fetch issue from GitHub
        issue = await self._fetch_issue(issue_number)
        
        # Build prompt
        prompt = self._build_task_prompt(agent_type, issue)
        
        # Execute
        result = await session.send_and_wait({"prompt": prompt})
        
        return {
            "success": True,
            "agent": agent_type,
            "issue_number": issue_number,
            "output": result.data.content,
            "files_generated": self._extract_files(result)
        }
    
    async def _fetch_issue(self, issue_number: int) -> dict:
        """Fetch issue from GitHub"""
        import subprocess
        result = subprocess.run(
            ["gh", "issue", "view", str(issue_number), "--json", 
             "title,body,labels"],
            capture_output=True,
            text=True
        )
        import json
        return json.loads(result.stdout)
    
    def _build_task_prompt(self, agent_type: str, issue: dict) -> str:
        """Build task prompt for agent"""
        prompts = {
            "pm": f"""
Create a Product Requirements Document (PRD) for the following issue:

**Issue #{issue['number']}:** {issue['title']}

**Description:**
{issue['body']}

Use the PRD template at .github/templates/PRD-TEMPLATE.md.
Include:
- User stories
- Acceptance criteria
- Technical constraints
- Success metrics

Use the generate_prd tool to create the document.
""",
            "architect": f"""
Create an Architecture Decision Record (ADR) for:

**Issue #{issue['number']}:** {issue['title']}

**Description:**
{issue['body']}

Use the ADR template at .github/templates/ADR-TEMPLATE.md.
Include:
- Context and problem
- Decision rationale
- Alternatives considered
- Consequences (positive & negative)

Use the generate_adr tool to create the document.
""",
        }
        
        return prompts.get(agent_type, f"Work on issue #{issue['number']}")
    
    def _extract_files(self, result) -> list:
        """Extract generated files from result"""
        # Parse result for file paths (e.g., "Created docs/prd/PRD-123.md")
        files = []
        # ... extraction logic
        return files
```

### 6. GitHub Actions Integration

**File:** `.github/workflows/agent-orchestrator.yml` (generated by `agentx init`)

```yaml
name: Agent Orchestrator

on:
  issues:
    types: [labeled]
  workflow_dispatch:
    inputs:
      issue_number:
        required: true

jobs:
  route-agent:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install AgentX
        run: pip install agentx-cli
      
      - name: Determine Agent
        id: route
        run: |
          # Get issue labels
          LABELS=$(gh issue view ${{ github.event.issue.number }} \
            --json labels -q '.labels[].name')
          
          # Route based on labels and orch:*-done state
          if [[ "$LABELS" =~ "type:epic" ]] && \
             [[ ! "$LABELS" =~ "orch:pm-done" ]]; then
            echo "agent=pm" >> $GITHUB_OUTPUT
            echo "mode=collaborate" >> $GITHUB_OUTPUT
          elif [[ "$LABELS" =~ "orch:pm-done" ]] && \
               [[ ! "$LABELS" =~ "orch:architect-done" ]]; then
            echo "agent=architect" >> $GITHUB_OUTPUT
            echo "mode=single" >> $GITHUB_OUTPUT
          elif [[ "$LABELS" =~ "type:story" ]]; then
            echo "agent=engineer" >> $GITHUB_OUTPUT
            echo "mode=single" >> $GITHUB_OUTPUT
          fi
      
      - name: Execute Agent
        if: steps.route.outputs.agent != ''
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          if [[ "${{ steps.route.outputs.mode }}" == "collaborate" ]]; then
            agentx collaborate ${{ github.event.issue.number }} \
              --agents pm,architect
          else
            agentx execute ${{ steps.route.outputs.agent }} \
              ${{ github.event.issue.number }}
          fi
      
      - name: Commit Results
        run: |
          git config user.name "AgentX Bot"
          git config user.email "agentx@github.com"
          git add docs/
          git commit -m "feat: agent output for #${{ github.event.issue.number }}" || true
          git push
```

### 7. Multi-Agent Collaboration

**File:** `agentx/core/collaboration.py`

```python
"""Multi-Agent Collaboration"""
import asyncio
from copilot import CopilotClient
from agentx.core.agent_executor import AgentExecutor

class AgentCollaboration:
    """Enable multiple agents to collaborate"""
    
    def __init__(self, participants: list):
        self.participants = participants  # ["pm", "architect"]
        self.client = None
        self.session = None
    
    async def execute(self, issue_number: int) -> dict:
        """
        Execute multi-agent collaboration
        
        Example: PM and Architect collaborate on Epic planning
        """
        self.client = CopilotClient()
        await self.client.start()
        
        try:
            # Load all agent configurations
            agent_configs = [
                self._load_agent_config(agent)
                for agent in self.participants
            ]
            
            # Create session with all agents
            self.session = await self.client.create_session({
                "model": "gpt-5.1",
                "custom_agents": agent_configs,
                "skill_directories": [".github/skills"],
                "system_message": {
                    "mode": "append",
                    "content": self._build_collaboration_context(issue_number)
                }
            })
            
            # Execute collaborative task
            result = await self._collaborate(issue_number)
            
            return result
            
        finally:
            if self.client:
                await self.client.stop()
    
    def _build_collaboration_context(self, issue_number: int) -> str:
        """Build context for collaboration"""
        return f"""
<collaboration>
<issue>#{issue_number}</issue>
<participants>{', '.join(self.participants)}</participants>

<objective>
Collaborate to produce high-quality deliverables for issue #{issue_number}.
Each agent contributes their expertise. Ask clarifying questions when needed.
</objective>

<workflow>
1. PM: Draft initial PRD
2. Architect: Review for technical feasibility
3. PM: Address concerns
4. Architect: Create ADR
5. Both: Approve final plan
</workflow>
</collaboration>
"""
    
    async def _collaborate(self, issue_number: int) -> dict:
        """Execute collaboration"""
        # Fetch issue
        import subprocess, json
        result = subprocess.run(
            ["gh", "issue", "view", str(issue_number), "--json", "title,body"],
            capture_output=True, text=True
        )
        issue = json.loads(result.stdout)
        
        # Collaborative prompt
        prompt = f"""
Work together on Issue #{issue_number}: {issue['title']}

{issue['body']}

Instructions:
1. PM: Create PRD using generate_prd tool
2. Architect: Review PRD and create ADR using generate_adr tool
3. Discuss any concerns and iterate
4. Finalize both documents
"""
        
        result = await self.session.send_and_wait({"prompt": prompt})
        
        return {
            "success": True,
            "participants": self.participants,
            "output": result.data.content
        }
```

---

## Implementation Plan

### Phase 1: Package Setup (1-2 days)

**Objective:** Create installable Python package

**Tasks:**
1. Create `setup.py` and `pyproject.toml`
2. Implement basic CLI with `agentx --version`
3. Test: `pip install -e . && agentx --help`

**Success Criteria:**
- ✅ Package installs successfully
- ✅ `agentx` command available

---

### Phase 2: Core CLI (3-5 days)

**Objective:** `init` and `create-prd` commands

**Tasks:**
1. Implement `agentx init` (copy templates, create dirs)
2. Implement `agentx create-prd <issue>`
3. Test with real GitHub issue

**Success Criteria:**
- ✅ `agentx init` sets up project
- ✅ `agentx create-prd` generates valid PRD

---

### Phase 3: More Agents (3-5 days)

**Objective:** All 5 agent commands

**Tasks:**
1. Implement `create-adr`, `implement`, `design`, `review`
2. Test each with real issues

**Success Criteria:**
- ✅ All agent commands working
- ✅ Quality matches manual work

---

### Phase 4: GitHub Actions (2-3 days)

**Objective:** Auto-trigger from labels

**Tasks:**
1. Update `agent-orchestrator.yml`
2. Test automation with labels

**Success Criteria:**
- ✅ Label triggers workflow
- ✅ Output committed to repo

---

### Phase 5: Collaboration (3-5 days)

**Objective:** Multi-agent conversations

**Tasks:**
1. Implement `agentx collaborate`
2. Test PM + Architect scenario

**Success Criteria:**
- ✅ Agents communicate
- ✅ Improved output quality

---

### Phase 6: Release (2-3 days)

**Objective:** Production release

**Tasks:**
1. Documentation
2. Testing
3. Publish to PyPI

**Success Criteria:**
- ✅ Package on PyPI
- ✅ Ready for users

**Total Timeline:** 2-3 weeks

---

## Cost & Licensing

**Free & Open Source:**
- ✅ AgentX CLI tool: **Free** (MIT License)
- ✅ Installation: **No cost**
- ✅ All features: **No subscription**

**Usage Costs (Pay what you use):**

| Component | Cost | Notes |
|-----------|------|-------|
| GitHub Copilot SDK | Included in Copilot subscription | Premium requests count against quota |
| GitHub Actions | Free tier: 2,000 min/mo | Or use existing paid plan |
| GitHub Copilot | $10-39/mo per user | Already paying if using Copilot |
| **AgentX Tool** | **$0** | **Completely free** |

**No Hidden Costs:**
- ❌ No hosting fees
- ❌ No database costs
- ❌ No infrastructure
- ❌ No per-seat licensing
- ✅ Just install and use

---

## Consequences

### Positive

1. **Zero Hosting Costs** - Runs locally or in Actions
2. **Instant Setup** - `pip install agentx-cli && agentx init`
3. **Works Anywhere** - Any project, any OS
4. **No Maintenance** - No servers to manage
5. **GitHub Native** - Uses Actions infrastructure
6. **Open Source** - Free for everyone

### Negative (Mitigations)

1. **SDK runs in Actions** → May take longer
   - *Mitigation*: Still fast enough (<2min typical)
   
2. **No centralized state** → Can't track across repos
   - *Mitigation*: Each repo is independent (feature, not bug)
   
3. **Requires Copilot subscription** → Cost barrier
   - *Mitigation*: Most devs already have Copilot
   
4. **GitHub Actions minutes** → May exhaust free tier
   - *Mitigation*: 2,000 free min = 400 agent runs/mo

---

## Success Metrics

**Adoption:**
- 100+ installs in first month
- 10+ projects using AgentX

**Usage:**
- 1,000+ PRDs generated
- 500+ ADRs created
- 80%+ quality vs manual

**Performance:**
- <2min agent execution
- <5min end-to-end (issue labeled → output committed)

---

## Alternatives Considered

### Alternative 1: Hosted Service (Azure Container Apps)
**Rejected:** Requires hosting, costs money, complex setup

### Alternative 2: VS Code Extension Only
**Rejected:** Doesn't work in CI/CD, requires VS Code

### Alternative 3: GitHub App
**Rejected:** Complex OAuth, installation friction

**Chosen:** CLI tool is simplest, most flexible, zero cost

---

**Last Updated:** January 22, 2026
