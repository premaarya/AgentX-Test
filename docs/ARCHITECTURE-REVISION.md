# AgentX Architecture: CLI Tool (Revised Approach)

> **Date:** January 22, 2026  
> **Change:** From hosted service → to installable CLI tool  
> **Reason:** Simplicity, zero hosting costs, instant setup

---

## ❌ What We're NOT Doing

**Old Approach (Rejected):**
- ❌ FastAPI hosted service
- ❌ Docker containers
- ❌ Azure Container Apps deployment
- ❌ Redis for state management
- ❌ Azure Blob Storage
- ❌ Complex infrastructure
- ❌ Monthly hosting costs ($100-730/mo)

**Why Rejected:** Too complex, requires hosting, ongoing costs, defeats "quick start" goal

---

## ✅ What We're Doing Instead

**New Approach (CLI Tool):**
- ✅ Python package: `pip install agentx-cli`
- ✅ Runs locally OR in GitHub Actions
- ✅ Zero hosting/infrastructure
- ✅ Zero cost (just uses Copilot subscription)
- ✅ 5-minute setup in any project
- ✅ Works everywhere (Mac, Linux, Windows)

---

## Architecture Comparison

### Old (Service-Based) ❌

```
Developer
   ↓ HTTPS
Azure Load Balancer
   ↓
Container Apps (2-10 instances)
   ↓ API Call
FastAPI Service
   ↓
Copilot SDK
   ↓
Redis (state) + Blob Storage (artifacts)

Cost: $100-730/mo
Setup: Hours/days
Maintenance: Ongoing
```

### New (CLI-Based) ✅

```
Developer
   ↓ Local command
agentx CLI (pip package)
   ↓
Copilot SDK (local)
   ↓
GitHub API (via gh CLI or MCP)
   ↓
Output to docs/

Cost: $0
Setup: 5 minutes
Maintenance: None
```

---

## Key Changes

### 1. No Hosted Service

**Before:**
```python
# FastAPI service at https://agentx-sdk.azurewebsites.net
POST /api/v1/agents/execute
{
  "agent_type": "engineer",
  "issue_number": 123
}
```

**After:**
```bash
# CLI command runs locally
agentx implement 123
```

### 2. No Docker/Containers

**Before:**
```dockerfile
FROM python:3.11-slim
COPY . /app
RUN pip install -r requirements.txt
CMD ["uvicorn", "main:app"]
```

**After:**
```bash
# Just install Python package
pip install agentx-cli
```

### 3. No Infrastructure

**Before:**
```yaml
# Azure Container Apps config
apiVersion: apps/v1
kind: ContainerApp
spec:
  containers:
    - name: sdk-service
      resources:
        cpu: 2.0
        memory: 4Gi
```

**After:**
```bash
# Runs wherever Python runs
python -m agentx.cli create-prd 123
```

### 4. Execution Location

**Before:** Remote service (Azure)

**After:** Two modes:
1. **Local:** `agentx create-prd 123` → Runs on developer's machine
2. **GitHub Actions:** Workflow installs `agentx-cli` and runs in Actions runner

### 5. State Management

**Before:** Redis for session state, Blob Storage for artifacts

**After:** 
- No external state needed
- Output files written directly to `docs/` in Git repo
- Committed via Git

---

## What Stays the Same

### 1. GitHub Integration
- ✅ Still uses GitHub Issues
- ✅ Still uses orchestration labels (`orch:pm-done`, etc.)
- ✅ Still uses GitHub Projects for tracking
- ✅ Still uses MCP Server for API calls

### 2. Agent Definitions
- ✅ Same agent definitions (`.github/agents/pm.agent.md`, etc.)
- ✅ Same 18 production skills (`.github/skills/`)
- ✅ Same templates (PRD, ADR, Spec, UX, Review)

### 3. Workflow
- ✅ Same Issue-First workflow
- ✅ Same agent routing logic
- ✅ Same orchestration protocol

### 4. SDK Usage
- ✅ Still uses GitHub Copilot SDK
- ✅ Still creates SDK sessions
- ✅ Still uses custom agents, tools, skills

---

## Benefits of CLI Approach

### 1. Zero Setup Friction

**Before (Service):**
```bash
# Complex setup
1. Create Azure account
2. Create Container App
3. Configure Redis
4. Configure Blob Storage
5. Deploy Docker image
6. Configure secrets
7. Set up monitoring
8. Wait 10-30 minutes
```

**After (CLI):**
```bash
# Simple setup
pip install agentx-cli && agentx init
# Done in 30 seconds
```

### 2. Works Anywhere

**Service:** Only accessible via HTTPS, requires internet

**CLI:** 
- ✅ Works offline (with local SDK)
- ✅ Works in CI/CD (GitHub Actions, Jenkins, etc.)
- ✅ Works on any OS
- ✅ Works in air-gapped environments (with proper SDK config)

### 3. Zero Cost

**Service:** $100-730/mo (Azure + Redis + Storage + bandwidth)

**CLI:** $0 (uses existing Copilot subscription + GitHub Actions free tier)

### 4. Instant Updates

**Service:** Deploy new version, roll out, monitor

**CLI:** `pip install --upgrade agentx-cli` (instant)

### 5. Local Development

**Service:** Must deploy to test changes

**CLI:** Test immediately with `pip install -e .` (editable install)

---

## Implementation Changes

### Before (Service)

**1. FastAPI Service:**
```python
# services/sdk-agent-service/main.py
@app.post("/api/v1/agents/execute")
async def execute_agent(request: AgentExecutionRequest):
    # Execute agent
    # Return execution_id
```

**2. Background Tasks:**
```python
background_tasks.add_task(run_agent_execution, execution_id)
```

**3. Status Polling:**
```bash
# GitHub Actions polls for completion
while true; do
  STATUS=$(curl /api/v1/executions/$EXEC_ID)
  if [ "$STATUS" == "completed" ]; then break; fi
  sleep 5
done
```

### After (CLI)

**1. CLI Commands:**
```python
# agentx/cli.py
@click.command()
@click.argument('issue_number', type=int)
def create_prd(issue_number):
    """Generate PRD for issue"""
    executor = AgentExecutor()
    result = asyncio.run(executor.execute('pm', issue_number))
    print(f"✅ Generated {result['file_path']}")
```

**2. Synchronous Execution:**
```python
# No background tasks needed
result = await executor.execute('pm', 123)
# Done!
```

**3. Direct Output:**
```bash
# GitHub Actions just runs command
agentx create-prd 123
# Output written to docs/prd/PRD-123.md
# Commit and done
```

---

## File Structure Changes

### Before (Service)

```
services/sdk-agent-service/    # Hosted service
├─ main.py                     # FastAPI app
├─ Dockerfile                  # Container image
├─ requirements.txt
├─ agents/
├─ tools/
├─ workflows/
└─ deploy/
   ├─ azure-container-app.yaml
   └─ deploy.sh
```

### After (CLI)

```
agentx/                        # Python package
├─ __init__.py
├─ cli.py                      # Click CLI
├─ setup.py                    # Package config
├─ core/
│  ├─ agent_executor.py        # SDK execution
│  └─ project_init.py          # agentx init
├─ agents/
│  ├─ pm.py
│  └─ engineer.py
├─ tools/
│  ├─ github_tools.py
│  └─ template_tools.py
└─ templates/                  # Bundled templates
   ├─ PRD-TEMPLATE.md
   └─ ADR-TEMPLATE.md
```

---

## Migration Impact

### Code to Keep

1. ✅ **Agent logic** - All agent implementations stay
2. ✅ **Tools** - All SDK tools stay (github_tools, template_tools, etc.)
3. ✅ **Templates** - All document templates stay
4. ✅ **Skills** - All 18 skills stay
5. ✅ **Workflows** - GitHub Actions workflows stay (just call CLI instead of API)

### Code to Remove

1. ❌ `main.py` (FastAPI app) → Replace with `cli.py` (Click CLI)
2. ❌ `Dockerfile` → Not needed
3. ❌ `deploy/` directory → Not needed
4. ❌ Background task management → Synchronous execution
5. ❌ Redis integration → Not needed
6. ❌ Azure configurations → Not needed

### Code to Transform

**From:**
```python
# FastAPI endpoint
@app.post("/api/v1/agents/execute")
async def execute_agent(request: AgentExecutionRequest):
    execution_id = uuid.uuid4()
    background_tasks.add_task(run_agent, request.agent_type, request.issue_number)
    return {"execution_id": execution_id, "status": "queued"}
```

**To:**
```python
# CLI command
@click.command()
@click.argument('issue_number', type=int)
def create_prd(issue_number):
    executor = AgentExecutor()
    result = asyncio.run(executor.execute('pm', issue_number))
    click.echo(f"✅ Generated {result['file_path']}")
```

---

## User Experience Comparison

### Before (Service)

**Setup:**
1. Sign up for Azure
2. Create resources
3. Deploy service
4. Configure secrets
5. Test endpoint
6. Update GitHub Actions to call service

**Usage:**
1. Label issue
2. Workflow triggers
3. Calls service API
4. Polls for completion
5. Downloads result

**Time:** 1-2 hours setup, 2-5 min per execution

### After (CLI)

**Setup:**
1. `pip install agentx-cli`
2. `agentx init`

**Usage:**
1. `agentx create-prd 123`

**Time:** 30 seconds setup, <2 min per execution

---

## Questions & Answers

### Q: Can I still use it in GitHub Actions?
**A:** Yes! Workflows install `agentx-cli` and run commands:
```yaml
- name: Install AgentX
  run: pip install agentx-cli

- name: Execute Agent
  run: agentx create-prd ${{ github.event.issue.number }}
```

### Q: What about multi-agent conversations?
**A:** Still supported via CLI:
```bash
agentx collaborate 123 --agents pm,architect
```

### Q: Can I use it without GitHub?
**A:** Yes, as long as you have GitHub issues in your repo. AgentX uses GitHub for task tracking but can work with any Git hosting that has similar issue tracking.

### Q: What about the SDK license/quota?
**A:** Same as before - uses your GitHub Copilot subscription. AgentX adds no additional licensing cost.

### Q: How does this affect performance?
**A:** **Better!** No network latency to hosted service. SDK runs locally or in GitHub Actions runner (same network as GitHub API).

### Q: Can I self-host if needed?
**A:** You don't need to! But if you want to run on your own infrastructure, just install the CLI tool on your servers and call it via CI/CD.

---

## Summary

| Aspect | Old (Service) | New (CLI) |
|--------|---------------|-----------|
| **Architecture** | Hosted FastAPI service | Installable Python CLI |
| **Deployment** | Azure Container Apps | `pip install` |
| **Cost** | $100-730/mo | $0 |
| **Setup Time** | 1-2 hours | 30 seconds |
| **Maintenance** | Ongoing (servers, monitoring) | None (just update pip package) |
| **Execution** | Remote API calls | Local or GitHub Actions |
| **State** | Redis + Blob Storage | Git repository |
| **Complexity** | High | Low |
| **Use Cases** | Large teams with existing infra | **Everyone** (quick start) |

---

## Next Steps

1. ✅ **ADR Updated:** [ADR-SDK-INTEGRATION-CLI.md](ADR-SDK-INTEGRATION-CLI.md)
2. ✅ **Quick Start Guide:** [CLI-QUICKSTART.md](CLI-QUICKSTART.md)
3. 🔄 **Implementation:** Start with Phase 1 (Package Setup)
4. 📦 **Publish:** Release to PyPI when ready

---

**Decision:** CLI tool approach approved. Proceed with implementation.

**Last Updated:** January 22, 2026
