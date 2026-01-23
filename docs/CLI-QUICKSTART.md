# AgentX CLI - Quick Start Guide

> **Purpose**: Get AI agents working in your project in 5 minutes  
> **No hosting, no Docker, no complexity** - just install and use

---

## 🚀 Quick Start

### 1. Install AgentX

```bash
# From PyPI (when published)
pip install agentx-cli

# OR from GitHub (development)
pip install git+https://github.com/jnPiyush/AgentX.git

# OR clone and install locally
git clone https://github.com/jnPiyush/AgentX.git
cd AgentX
pip install -e .
```

### 2. Initialize in Your Project

```bash
cd /path/to/your-project

# Initialize AgentX (creates .github/, agentx.yaml, docs/)
agentx init

# Configure GitHub token
export GITHUB_TOKEN=ghp_your_token_here
```

### 3. Use It!

```bash
# Create PRD for an issue
agentx create-prd 123

# Create technical spec
agentx create-adr 456

# Implement a feature
agentx implement 789

# Multi-agent collaboration
agentx collaborate 100 --agents pm,architect
```

That's it! No servers, no Docker, no hosting costs.

---

## 📋 Commands

### Core Commands

| Command | Description | Example |
|---------|-------------|---------|
| `agentx init` | Initialize AgentX in project | `agentx init` |
| `agentx create-prd <issue>` | Generate Product Requirements Document | `agentx create-prd 123` |
| `agentx create-adr <issue>` | Generate Architecture Decision Record | `agentx create-adr 456` |
| `agentx implement <issue>` | Implement story/feature | `agentx implement 789` |
| `agentx design <issue>` | Create UX design | `agentx design 101` |
| `agentx review <pr>` | Review pull request | `agentx review 42` |
| `agentx collaborate <issue>` | Multi-agent collaboration | `agentx collaborate 100 --agents pm,architect` |
| `agentx chat --agent <type>` | Interactive agent conversation | `agentx chat --agent engineer` |
| `agentx doctor` | Validate setup | `agentx doctor` |
| `agentx update` | Update AgentX | `agentx update` |

### Agent Types

- `pm` - Product Manager (creates PRDs, breaks down epics)
- `architect` - Solution Architect (creates ADRs, technical specs)
- `engineer` - Software Engineer (implements code with tests)
- `ux` - UX Designer (creates wireframes, designs)
- `reviewer` - Code Reviewer (reviews PRs, quality checks)

---

## 🏗️ What `agentx init` Creates

```
your-project/
├─ .github/
│  ├─ workflows/
│  │  ├─ agent-orchestrator.yml    # Auto-routes issues to agents
│  │  ├─ run-pm.yml                # PM agent workflow
│  │  ├─ run-architect.yml         # Architect workflow
│  │  ├─ run-engineer.yml          # Engineer workflow
│  │  ├─ run-ux.yml                # UX workflow
│  │  └─ run-reviewer.yml          # Reviewer workflow
│  ├─ agents/
│  │  ├─ pm.agent.md               # PM agent definition
│  │  ├─ architect.agent.md        # Architect definition
│  │  ├─ engineer.agent.md         # Engineer definition
│  │  ├─ ux.agent.md               # UX definition
│  │  └─ reviewer.agent.md         # Reviewer definition
│  ├─ skills/                       # 18 production skills
│  │  ├─ testing/SKILL.md
│  │  ├─ security/SKILL.md
│  │  ├─ api-design/SKILL.md
│  │  └─ ... (15 more)
│  └─ templates/                    # Document templates
│     ├─ PRD-TEMPLATE.md
│     ├─ ADR-TEMPLATE.md
│     ├─ SPEC-TEMPLATE.md
│     ├─ UX-TEMPLATE.md
│     └─ REVIEW-TEMPLATE.md
├─ docs/
│  ├─ prd/                          # Generated PRDs
│  ├─ adr/                          # Generated ADRs
│  ├─ specs/                        # Generated specs
│  ├─ ux/                           # Generated UX docs
│  └─ reviews/                      # Generated reviews
└─ agentx.yaml                      # Configuration file
```

---

## ⚙️ Configuration

### `agentx.yaml` (Auto-generated)

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
  
  engineer:
    enabled: true
    model: "gpt-5.1-codex-max"  # Best for coding
    temperature: 0.1
    skills:
      - testing
      - security
      - error-handling
  
  ux_designer:
    enabled: true
    model: "gpt-5.1"
    skills:
      - documentation
  
  reviewer:
    enabled: true
    model: "gpt-5.1"
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

**Customize:** Edit `agentx.yaml` to change models, enable/disable agents, or adjust output paths.

---

## 🤖 Usage Examples

### Example 1: Create PRD for New Feature

```bash
# You have a GitHub issue #123 for "User Authentication"

# Generate PRD
agentx create-prd 123

# Output:
# ✅ Fetched issue #123 from GitHub
# ✅ PM agent analyzing requirements...
# ✅ Generated PRD at docs/prd/PRD-123.md
# ✅ Added label 'orch:pm-done' to issue
# ✅ Committed to Git

# View the PRD
cat docs/prd/PRD-123.md
```

### Example 2: Architect Reviews PRD and Creates ADR

```bash
# PRD is ready, now architect creates technical design

agentx create-adr 123

# Output:
# ✅ Fetched issue #123 and PRD-123.md
# ✅ Architect agent analyzing architecture...
# ✅ Generated ADR at docs/adr/ADR-123.md
# ✅ Added label 'orch:architect-done'
# ✅ Committed to Git
```

### Example 3: Multi-Agent Collaboration

```bash
# PM and Architect collaborate on Epic planning

agentx collaborate 100 --agents pm,architect

# Output:
# ✅ Starting collaboration session...
# ✅ PM: Drafting initial PRD...
# ✅ Architect: Reviewing for technical feasibility...
# ✅ PM: Addressing concerns...
# ✅ Architect: Creating ADR...
# ✅ Collaboration complete!
# ✅ Generated PRD-100.md and ADR-100.md
```

### Example 4: Engineer Implements Feature

```bash
# Issue #123 has PRD and ADR, ready for implementation

agentx implement 123

# Output:
# ✅ Fetched specs for issue #123
# ✅ Engineer agent implementing...
# ✅ Generated code in src/auth/
# ✅ Generated tests in tests/auth/
# ✅ Test coverage: 85%
# ✅ Security scan: PASSED
# ✅ Created PR #456
# ✅ Added label 'orch:engineer-done'
```

### Example 5: Interactive Chat

```bash
# Ask engineer questions interactively

agentx chat --agent engineer

# Prompt:
You: How do I implement OAuth2 in Python?

Engineer: Here's a production-ready OAuth2 implementation using FastAPI...
[code example]

You: Add error handling

Engineer: Updated with try-except blocks and retry logic...
[updated code]

You: exit

# Session saved to docs/conversations/
```

---

## 🔄 GitHub Actions Automation

### Automatic Agent Execution

**Workflow:** `.github/workflows/agent-orchestrator.yml` (created by `agentx init`)

**Triggers:**
- Issue labeled with `type:epic`, `type:feature`, `type:story`, etc.
- Manual dispatch via GitHub UI

**Flow:**
```
Issue labeled 'type:feature'
  ↓
GitHub Actions workflow triggered
  ↓
Installs agentx-cli in runner
  ↓
Routes to appropriate agent (PM, Architect, Engineer)
  ↓
Agent executes and generates output
  ↓
Output committed to repo
  ↓
Orchestration label added (orch:pm-done, etc.)
  ↓
Next agent triggered automatically
```

**Example:**

```yaml
# .github/workflows/agent-orchestrator.yml
name: Agent Orchestrator

on:
  issues:
    types: [labeled]

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
      
      - name: Execute Agent
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Determine agent based on labels
          LABELS=$(gh issue view ${{ github.event.issue.number }} \
            --json labels -q '.labels[].name')
          
          if [[ "$LABELS" =~ "type:epic" ]]; then
            agentx collaborate ${{ github.event.issue.number }} \
              --agents pm,architect
          elif [[ "$LABELS" =~ "type:feature" ]]; then
            agentx create-prd ${{ github.event.issue.number }}
          elif [[ "$LABELS" =~ "type:story" ]]; then
            agentx implement ${{ github.event.issue.number }}
          fi
      
      - name: Commit Results
        run: |
          git config user.name "AgentX Bot"
          git config user.email "agentx@github.com"
          git add docs/
          git commit -m "feat: agent output for #${{ github.event.issue.number }}" || true
          git push
```

---

## 🧪 Testing

### Test in Fresh Project

```bash
# Create test project
mkdir test-agentx
cd test-agentx
git init

# Initialize AgentX
pip install agentx-cli
agentx init

# Validate setup
agentx doctor

# Output:
# ✅ AgentX CLI installed
# ✅ Configuration found (agentx.yaml)
# ✅ GitHub CLI installed
# ✅ GitHub token configured
# ✅ Templates found (.github/templates/)
# ✅ Skills found (.github/skills/)
# ✅ Workflows found (.github/workflows/)
# ✅ All checks passed!

# Test with dummy issue
agentx create-prd 1  # Assumes you have a GitHub issue #1
```

---

## 💡 Advanced Usage

### Custom Models

Edit `agentx.yaml` to change models:

```yaml
agents:
  engineer:
    model: "claude-opus-4-5"  # Use Claude instead of GPT
    temperature: 0.1
```

### Disable Agents

```yaml
agents:
  ux_designer:
    enabled: false  # Don't use UX agent
```

### Custom Output Paths

```yaml
output:
  prd: "documentation/requirements"
  adr: "documentation/architecture"
```

### Skip Auto-Commit

```yaml
github:
  auto_commit: false  # Don't commit automatically
```

Then commit manually:
```bash
agentx create-prd 123
git add docs/prd/PRD-123.md
git commit -m "docs: add PRD for feature #123"
```

---

## 🐛 Troubleshooting

### Issue: `agentx: command not found`

**Solution:**
```bash
# Ensure Python bin directory is in PATH
export PATH="$HOME/.local/bin:$PATH"

# Or install with --user flag
pip install --user agentx-cli
```

### Issue: `GitHub token not configured`

**Solution:**
```bash
# Create token at https://github.com/settings/tokens
# Scopes: repo, workflow

# Export token
export GITHUB_TOKEN=ghp_your_token_here

# Or add to shell profile
echo 'export GITHUB_TOKEN=ghp_your_token_here' >> ~/.bashrc
source ~/.bashrc
```

### Issue: `SDK connection failed`

**Solution:**
```bash
# Ensure GitHub Copilot CLI installed
copilot --version

# If not installed:
# Visit https://github.com/github/copilot-sdk
```

### Issue: `Agent timeout`

**Solution:**
```yaml
# Increase timeout in agentx.yaml
agents:
  engineer:
    timeout: 300  # 5 minutes instead of default 2 min
```

### Issue: `Permission denied writing to docs/`

**Solution:**
```bash
# Ensure docs/ directory is writable
chmod -R u+w docs/

# Or run with appropriate permissions
sudo agentx create-prd 123
```

---

## 📊 Cost

**AgentX CLI Tool:** **FREE** (MIT License)

**Usage Costs:**

| Component | Cost | Notes |
|-----------|------|-------|
| GitHub Copilot | $10-39/mo | Already paying if using Copilot |
| GitHub Actions | Free tier: 2,000 min/mo | ~400 agent runs/mo |
| AgentX Tool | $0 | Completely free |

**No hidden costs:**
- ❌ No hosting fees
- ❌ No database costs
- ❌ No infrastructure
- ✅ Just install and use

---

## 📚 Next Steps

1. **Try it:** Install and run `agentx init` in a test project
2. **Explore:** Test each command with real GitHub issues
3. **Automate:** Let GitHub Actions run agents automatically
4. **Customize:** Edit `agentx.yaml` to fit your workflow
5. **Share:** Contribute improvements back to AgentX

---

## 🆘 Support

- **Documentation:** [AGENTS.md](../AGENTS.md) - Complete workflows
- **Skills:** [Skills.md](../Skills.md) - 18 production skills
- **Issues:** [GitHub Issues](https://github.com/jnPiyush/AgentX/issues)
- **Discussions:** [GitHub Discussions](https://github.com/jnPiyush/AgentX/discussions)

---

## 🎯 Real-World Example

**Scenario:** You have a new feature request for "User Authentication"

**Step 1:** Create GitHub issue #123

**Step 2:** Run PM agent
```bash
agentx create-prd 123
# Generates: docs/prd/PRD-123.md
```

**Step 3:** Run Architect agent
```bash
agentx create-adr 123
# Generates: docs/adr/ADR-123.md
```

**Step 4:** Run Engineer agent
```bash
agentx implement 123
# Generates:
#   - src/auth/oauth.py
#   - tests/auth/test_oauth.py
#   - Creates PR #456
```

**Step 5:** Review PR
```bash
agentx review 456
# Generates: docs/reviews/REVIEW-456.md
# Adds review comments to PR
```

**Total Time:** ~10 minutes (vs hours/days manually)  
**Total Cost:** $0 (uses existing Copilot subscription)  
**Quality:** Production-ready code with 80%+ test coverage

---

**Last Updated:** January 22, 2026
