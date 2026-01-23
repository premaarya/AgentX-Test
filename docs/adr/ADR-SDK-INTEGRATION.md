# ADR: GitHub Copilot SDK Production Integration

> **Status**: Proposed  
> **Date**: January 22, 2026  
> **Decision Makers**: Engineering Team  
> **Supersedes**: N/A

---

## Context

AgentX currently uses a 3-layer hybrid orchestration model:
- **Layer 1**: GraphQL (fast operations, 1-2s)
- **Layer 2**: GitHub Actions (complex execution, 10-60s)
- **Layer 3**: MCP Server (coordination, <1s)

The GitHub Copilot SDK (v0.1.16+) offers capabilities that could enhance agent intelligence, enable multi-agent conversations, and make skills executable. We need to determine how to integrate the SDK while maintaining current performance and reliability.

---

## Decision

**We will adopt a 4-layer Enhanced Hybrid Architecture** that integrates the Copilot SDK as an intelligent execution layer while preserving our proven orchestration infrastructure.

### Architecture: 4-Layer Enhanced Hybrid Model

```
┌──────────────────────────────────────────────────────────────────────┐
│              AgentX Enhanced Architecture (SDK-Powered)               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Layer 1: GraphQL API (1-2s) - UNCHANGED                            │
│  ├─ Fast operations: assign, label, comment                          │
│  └─ Direct GitHub API access                                         │
│                          ↓                                            │
│  Layer 2: GitHub Actions (Orchestration) - ENHANCED                  │
│  ├─ Workflow: agent-orchestrator.yml                                │
│  ├─ Determines next agent via routing logic                          │
│  └─ NOW TRIGGERS: SDK-powered agent execution                        │
│                          ↓                                            │
│  Layer 3: Copilot SDK (Intelligence) - NEW                          │
│  ├─ Hosted Service: sdk-agent-service (Python FastAPI)              │
│  ├─ Agent execution with custom agents & skills                     │
│  ├─ Multi-agent conversations                                        │
│  ├─ Template-based document generation                               │
│  └─ Executable skills as SDK tools                                   │
│                          ↓                                            │
│  Layer 4: MCP Server (Coordination) - ENHANCED                      │
│  ├─ GitHub MCP for issue/PR operations                              │
│  ├─ Custom MCP for AgentX operations                                │
│  └─ Tool integration with SDK                                        │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Design

### 1. SDK Agent Service Architecture

**Component**: `services/sdk-agent-service/`

**Technology Stack**:
- **Runtime**: Python 3.11+ (FastAPI)
- **SDK**: `github-copilot-sdk` (Python)
- **Hosting**: GitHub Actions self-hosted runner OR Azure Container Apps
- **State**: Redis for session management
- **Monitoring**: OpenTelemetry + Azure Monitor

**Directory Structure**:
```
services/sdk-agent-service/
├── main.py                    # FastAPI application
├── agents/
│   ├── pm_agent.py           # Product Manager agent
│   ├── architect_agent.py    # Solution Architect agent
│   ├── ux_agent.py           # UX Designer agent
│   ├── engineer_agent.py     # Engineer agent
│   └── reviewer_agent.py     # Reviewer agent
├── tools/
│   ├── github_tools.py       # GitHub operations (issues, PRs)
│   ├── document_tools.py     # Template-based doc generation
│   ├── code_tools.py         # Code generation & analysis
│   └── security_tools.py     # Security scanning (executable skills)
├── skills/
│   ├── loader.py             # Load skills from .github/skills/
│   └── converters/           # Convert doc skills to SDK tools
├── templates/
│   ├── prd_template.py       # PRD generation logic
│   ├── adr_template.py       # ADR generation logic
│   ├── spec_template.py      # Spec generation logic
│   └── review_template.py    # Review generation logic
├── workflows/
│   ├── orchestrator.py       # Multi-agent workflow engine
│   └── conversation.py       # Agent-to-agent conversation handler
├── config/
│   ├── agents.yaml           # Agent configurations
│   └── skills.yaml           # Skill-to-tool mappings
└── tests/
    ├── test_agents.py
    ├── test_tools.py
    └── test_workflows.py
```

---

### 2. Agent Configuration (YAML-Driven)

**File**: `services/sdk-agent-service/config/agents.yaml`

```yaml
agents:
  product_manager:
    name: "product-manager"
    display_name: "Product Manager"
    description: "Creates PRDs and decomposes epics into features/stories"
    prompt_file: ".github/agents/pm.agent.md"
    tools:
      - github_issues      # GitHub issue operations
      - document_generator # Template-based PRD generation
      - research_tool      # Codebase research
      - quality_checker    # Self-review validation
    skills:
      - code-organization  # Loaded from .github/skills/
      - documentation
      - api-design
    model: "gpt-5.1"
    temperature: 0.3
    max_tokens: 8000
    
  architect:
    name: "architect"
    display_name: "Solution Architect"
    description: "Creates ADRs and technical specifications"
    prompt_file: ".github/agents/architect.agent.md"
    tools:
      - github_issues
      - document_generator
      - code_analyzer
      - architecture_validator
    skills:
      - core-principles
      - scalability
      - security
      - performance
      - database
    model: "claude-opus-4-5"  # Better for architecture
    temperature: 0.2
    
  engineer:
    name: "engineer"
    display_name: "Software Engineer"
    description: "Implements code with tests following specs"
    prompt_file: ".github/agents/engineer.agent.md"
    tools:
      - github_issues
      - code_generator
      - test_generator
      - security_scanner   # Executable skill
      - linter            # Executable skill
    skills:
      - testing
      - security
      - error-handling
      - performance
      - type-safety
    model: "gpt-5.1-codex-max"  # Best for coding
    temperature: 0.1
    
  ux_designer:
    name: "ux-designer"
    display_name: "UX Designer"
    description: "Creates wireframes and user flows"
    prompt_file: ".github/agents/ux.agent.md"
    tools:
      - github_issues
      - document_generator
      - wireframe_generator
      - accessibility_checker
    skills:
      - documentation
      - api-design
    model: "gpt-5.1"
    temperature: 0.4  # More creative for UX
    
  reviewer:
    name: "reviewer"
    display_name: "Code Reviewer"
    description: "Reviews code for quality, security, and best practices"
    prompt_file: ".github/agents/reviewer.agent.md"
    tools:
      - github_issues
      - github_pr
      - code_analyzer
      - security_scanner
      - quality_checker
      - document_generator  # Review reports
    skills:
      - code-review-and-audit
      - security
      - testing
      - performance
    model: "claude-opus-4-5"  # Best for analysis
    temperature: 0.0  # Deterministic reviews
```

---

### 3. Template-Based Document Generation

**File**: `services/sdk-agent-service/templates/prd_template.py`

```python
"""PRD Template Generator - SDK Tool"""
from copilot import defineTool
from typing import Dict, List
import yaml

def load_prd_template() -> str:
    """Load PRD template from .github/templates/PRD-TEMPLATE.md"""
    with open(".github/templates/PRD-TEMPLATE.md") as f:
        return f.read()

@defineTool(description="Generate a Product Requirements Document using the standard template")
async def generate_prd(
    issue_number: int,
    title: str,
    description: str,
    user_stories: List[str],
    acceptance_criteria: List[Dict[str, str]],
    technical_constraints: List[str] = None
) -> Dict[str, str]:
    """
    Generate PRD using AgentX standard template.
    
    Args:
        issue_number: GitHub issue number
        title: Feature/epic title
        description: Detailed description
        user_stories: List of user stories
        acceptance_criteria: List of {story: str, criteria: str}
        technical_constraints: Optional technical constraints
        
    Returns:
        Dict with 'content' (markdown) and 'file_path'
    """
    template = load_prd_template()
    
    # Fill template sections
    prd_content = template.format(
        issue_number=issue_number,
        title=title,
        description=description,
        user_stories="\n".join(f"- {story}" for story in user_stories),
        acceptance_criteria="\n\n".join(
            f"**{ac['story']}:**\n{ac['criteria']}" 
            for ac in acceptance_criteria
        ),
        constraints="\n".join(f"- {c}" for c in (technical_constraints or [])),
        date=datetime.now().strftime("%B %d, %Y")
    )
    
    file_path = f"docs/prd/PRD-{issue_number}.md"
    
    # Write to file
    os.makedirs("docs/prd", exist_ok=True)
    with open(file_path, "w") as f:
        f.write(prd_content)
    
    # Commit via MCP
    await commit_file(file_path, f"docs: add PRD for issue #{issue_number}")
    
    return {
        "content": prd_content,
        "file_path": file_path,
        "success": True
    }
```

**Similar Templates**:
- `adr_template.py` - Architecture Decision Records
- `spec_template.py` - Technical Specifications
- `ux_template.py` - UX Design Documents
- `review_template.py` - Code Review Reports

---

### 4. Executable Skills as SDK Tools

**File**: `services/sdk-agent-service/tools/security_tools.py`

```python
"""Security Tools - Executable Skills from security/SKILL.md"""
from copilot import defineTool
import subprocess
import json

@defineTool(description="Scan code for SQL injection vulnerabilities")
async def scan_sql_injection(file_path: str) -> Dict:
    """
    Executable implementation of Security Skill - SQL Injection Prevention
    Based on: .github/skills/security/SKILL.md
    """
    results = {
        "file": file_path,
        "vulnerabilities": [],
        "severity": "none"
    }
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Check for string concatenation in SQL
    patterns = [
        (r'\"SELECT.*\+', "String concatenation in SQL query"),
        (r'f\"SELECT.*{', "F-string interpolation in SQL query"),
        (r'\.format\(.*SELECT', "String format in SQL query"),
    ]
    
    for pattern, message in patterns:
        if re.search(pattern, content):
            results["vulnerabilities"].append({
                "type": "SQL_INJECTION",
                "message": message,
                "severity": "HIGH",
                "line": content.count('\n', 0, re.search(pattern, content).start()) + 1,
                "recommendation": "Use parameterized queries or ORM"
            })
            results["severity"] = "HIGH"
    
    return results

@defineTool(description="Scan code for XSS vulnerabilities")
async def scan_xss(file_path: str) -> Dict:
    """XSS vulnerability scanning based on security skill"""
    # Implementation based on .github/skills/security/SKILL.md
    # Checks for unescaped user input in HTML output
    pass

@defineTool(description="Run OWASP Top 10 security scan")
async def run_owasp_scan(directory: str) -> Dict:
    """
    Complete OWASP Top 10 security scan
    Combines multiple security skills into one executable tool
    """
    results = {
        "sql_injection": await scan_sql_injection(directory),
        "xss": await scan_xss(directory),
        "auth": await check_authentication(directory),
        "sensitive_data": await scan_sensitive_data(directory),
        "overall_score": 0
    }
    
    # Calculate overall security score
    results["overall_score"] = calculate_security_score(results)
    
    return results
```

**Skill-to-Tool Mapping**:
```yaml
# config/skills.yaml
executable_skills:
  security:
    tools:
      - scan_sql_injection
      - scan_xss
      - run_owasp_scan
      - check_authentication
    source: ".github/skills/security/SKILL.md"
    
  testing:
    tools:
      - generate_unit_tests
      - calculate_coverage
      - run_test_suite
    source: ".github/skills/testing/SKILL.md"
    
  performance:
    tools:
      - profile_code
      - analyze_memory
      - benchmark_api
    source: ".github/skills/performance/SKILL.md"

guidance_skills:  # Remain as documentation
  - core-principles
  - code-organization
  - documentation
  - version-control
```

---

### 5. Multi-Agent Conversation Engine

**File**: `services/sdk-agent-service/workflows/conversation.py`

```python
"""Multi-Agent Conversation Handler"""
from copilot import CopilotClient, CustomAgentConfig
from typing import List, Dict

class AgentConversation:
    """Manages multi-agent conversations with context preservation"""
    
    def __init__(self, issue_number: int, participants: List[str]):
        self.issue_number = issue_number
        self.participants = participants
        self.client = None
        self.session = None
        self.conversation_history = []
        
    async def start(self):
        """Initialize SDK session with multiple custom agents"""
        self.client = CopilotClient()
        await self.client.start()
        
        # Load agent configurations
        agents = [load_agent_config(name) for name in self.participants]
        
        self.session = await self.client.create_session({
            "model": "gpt-5.1",
            "custom_agents": agents,
            "mcp_servers": {
                "github": {
                    "type": "http",
                    "url": "https://api.githubcopilot.com/mcp/"
                },
                "agentx": {
                    "type": "local",
                    "command": "python",
                    "args": ["services/mcp-server/server.py"]
                }
            },
            "skill_directories": [".github/skills"],
            "system_message": {
                "mode": "append",
                "content": self._get_conversation_context()
            }
        })
        
        # Listen for subagent events
        self.session.on(self._handle_agent_event)
        
    def _get_conversation_context(self) -> str:
        """Build context for the conversation"""
        return f"""
<conversation_context>
<issue>#{self.issue_number}</issue>
<repository>jnPiyush/AgentX</repository>
<workflow>AGENTS.md - Issue-First Workflow</workflow>
<participants>
{", ".join(self.participants)}
</participants>

<rules>
1. Follow strict workflow: Research → Classify → Create Issue → Execute
2. Use templates for document generation
3. Execute self-review before completion
4. Add orch:*-done label when complete
5. All agents collaborate to produce high-quality output
</rules>

<templates>
- PRD: .github/templates/PRD-TEMPLATE.md
- ADR: .github/templates/ADR-TEMPLATE.md
- Spec: .github/templates/SPEC-TEMPLATE.md
- UX: .github/templates/UX-TEMPLATE.md
- Review: .github/templates/REVIEW-TEMPLATE.md
</templates>
</conversation_context>
"""
    
    async def run(self, initial_prompt: str) -> Dict:
        """
        Execute multi-agent conversation
        
        Example flow:
        1. PM creates PRD and asks Architect for technical feasibility
        2. Architect reviews PRD, asks clarifying questions
        3. PM answers questions
        4. Architect creates ADR and Spec
        5. UX Designer creates wireframes based on PRD + Spec
        6. Engineer reviews Spec + UX, asks questions if unclear
        7. All agents reach consensus, work proceeds
        """
        result = await self.session.send_and_wait({
            "prompt": initial_prompt,
            "mode": "enqueue"  # Allow multi-turn conversation
        })
        
        return {
            "conversation_id": self.session.session_id,
            "participants": self.participants,
            "messages": self.conversation_history,
            "final_result": result.data.content,
            "artifacts": self._extract_artifacts()
        }
    
    def _handle_agent_event(self, event):
        """Track agent interactions"""
        if event.type == "subagent.started":
            self.conversation_history.append({
                "agent": event.data.agent_name,
                "action": "started",
                "timestamp": event.timestamp
            })
        elif event.type == "assistant.message":
            self.conversation_history.append({
                "agent": "current",
                "message": event.data.content,
                "timestamp": event.timestamp
            })
        elif event.type == "tool.execution_complete":
            self.conversation_history.append({
                "agent": "current",
                "tool": event.data.tool_name,
                "result": "completed",
                "timestamp": event.timestamp
            })
    
    def _extract_artifacts(self) -> List[Dict]:
        """Extract generated documents from conversation"""
        artifacts = []
        for msg in self.conversation_history:
            if "file_path" in str(msg):
                # Extract file paths from tool execution results
                artifacts.append(msg)
        return artifacts


# Example Usage in Agent Orchestrator
async def run_pm_with_clarifications(issue_number: int):
    """PM agent with ability to ask UX/Architect for input"""
    conversation = AgentConversation(
        issue_number=issue_number,
        participants=["product-manager", "ux-designer", "architect"]
    )
    
    await conversation.start()
    
    result = await conversation.run(f"""
    Product Manager: Create a comprehensive PRD for issue #{issue_number}.
    
    Instructions:
    1. Research the issue and codebase
    2. Draft initial PRD using the template
    3. Ask UX Designer about user experience concerns
    4. Ask Architect about technical feasibility
    5. Incorporate feedback and finalize PRD
    6. Create feature and story issues
    7. Add orch:pm-done label when complete
    """)
    
    return result
```

---

### 6. Agent Handoff with SDK

**File**: `services/sdk-agent-service/workflows/orchestrator.py`

```python
"""SDK-Powered Agent Orchestration"""

class SDKOrchestrator:
    """Orchestrates agent execution using Copilot SDK"""
    
    async def execute_agent(
        self, 
        agent_type: str, 
        issue_number: int,
        mode: str = "single"  # "single" or "conversation"
    ) -> Dict:
        """
        Execute agent with full SDK capabilities
        
        Args:
            agent_type: pm, architect, ux, engineer, reviewer
            issue_number: GitHub issue number
            mode: "single" (standard handoff) or "conversation" (multi-agent)
        """
        if mode == "conversation":
            return await self._execute_conversation_mode(agent_type, issue_number)
        else:
            return await self._execute_single_mode(agent_type, issue_number)
    
    async def _execute_single_mode(self, agent_type: str, issue_number: int):
        """Standard single-agent execution with handoff"""
        agent_config = load_agent_config(agent_type)
        
        client = CopilotClient()
        await client.start()
        
        session = await client.create_session({
            "custom_agents": [agent_config],
            "skill_directories": [".github/skills"],
            "tools": self._load_tools_for_agent(agent_type),
            "mcp_servers": {
                "github": {"type": "http", "url": "https://api.githubcopilot.com/mcp/"}
            }
        })
        
        # Agent-specific prompt based on role
        prompt = self._get_agent_prompt(agent_type, issue_number)
        
        # Execute with streaming for progress visibility
        session.on(self._log_progress)
        
        result = await session.send_and_wait({"prompt": prompt})
        
        # Self-review before completion
        review_result = await self._self_review(session, agent_type, result)
        
        if review_result["passed"]:
            # Add completion label and trigger next agent
            await self._complete_handoff(agent_type, issue_number)
        else:
            # Request fixes
            await self._request_fixes(session, review_result["issues"])
        
        await session.destroy()
        
        return {
            "agent": agent_type,
            "issue": issue_number,
            "result": result.data.content,
            "artifacts": self._extract_artifacts(result),
            "review": review_result
        }
    
    def _get_agent_prompt(self, agent_type: str, issue_number: int) -> str:
        """Generate role-specific prompt with workflow context"""
        base_prompt = f"""
You are the {agent_type} agent working on issue #{issue_number}.

<workflow>
Read AGENTS.md for complete workflow.
Follow Issue-First approach strictly.
</workflow>

<your_role>
{self._get_role_description(agent_type)}
</your_role>

<deliverables>
{self._get_deliverables(agent_type)}
</deliverables>

<self_review>
Before completion, verify:
1. All deliverables created using templates
2. Quality standards met
3. No security issues
4. Tests pass (if applicable)
5. Documentation updated
</self_review>

<handoff>
When complete:
1. Commit all deliverables
2. Add orch:{agent_type}-done label
3. Post summary comment
</handoff>

Execute your role now.
"""
        return base_prompt
    
    async def _self_review(self, session, agent_type: str, result) -> Dict:
        """Agent performs self-review before handoff"""
        review_prompt = f"""
Review your work for issue before marking complete:

<checklist>
{self._get_review_checklist(agent_type)}
</checklist>

Respond with JSON:
{{
  "passed": true/false,
  "score": 0-100,
  "issues": ["issue 1", "issue 2"],
  "recommendations": ["rec 1"]
}}
"""
        review = await session.send_and_wait({"prompt": review_prompt})
        
        try:
            return json.loads(review.data.content)
        except:
            # Fallback if response isn't JSON
            return {"passed": True, "score": 80, "issues": [], "recommendations": []}
    
    async def _complete_handoff(self, agent_type: str, issue_number: int):
        """Complete handoff using GraphQL (fast)"""
        label_map = {
            "pm": "orch:pm-done",
            "architect": "orch:architect-done",
            "ux": "orch:ux-done",
            "engineer": "orch:engineer-done"
        }
        
        # Use existing GraphQL action for fast label update
        await add_label_graphql(issue_number, label_map[agent_type])
        
        # Post completion comment
        await add_comment_graphql(
            issue_number, 
            f"✅ {agent_type} agent completed. Work handed off to next agent."
        )
```

---

### 7. API Service (FastAPI)

**File**: `services/sdk-agent-service/main.py`

```python
"""SDK Agent Service - FastAPI Application"""
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
import asyncio

app = FastAPI(title="AgentX SDK Agent Service", version="1.0.0")

class AgentExecutionRequest(BaseModel):
    agent_type: str  # pm, architect, ux, engineer, reviewer
    issue_number: int
    mode: str = "single"  # single or conversation
    participants: List[str] = None  # For conversation mode

class AgentExecutionResponse(BaseModel):
    execution_id: str
    status: str  # queued, running, completed, failed
    agent: str
    issue_number: int

@app.post("/api/v1/agents/execute", response_model=AgentExecutionResponse)
async def execute_agent(
    request: AgentExecutionRequest,
    background_tasks: BackgroundTasks
):
    """
    Execute agent asynchronously
    Called by GitHub Actions workflow
    """
    execution_id = generate_execution_id()
    
    # Queue execution
    background_tasks.add_task(
        run_agent_execution,
        execution_id=execution_id,
        agent_type=request.agent_type,
        issue_number=request.issue_number,
        mode=request.mode,
        participants=request.participants
    )
    
    return AgentExecutionResponse(
        execution_id=execution_id,
        status="queued",
        agent=request.agent_type,
        issue_number=request.issue_number
    )

@app.get("/api/v1/executions/{execution_id}")
async def get_execution_status(execution_id: str):
    """Get execution status and results"""
    status = await get_execution_from_cache(execution_id)
    return status

@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "sdk_version": get_sdk_version(),
        "active_sessions": get_active_session_count()
    }

async def run_agent_execution(
    execution_id: str,
    agent_type: str,
    issue_number: int,
    mode: str,
    participants: List[str] = None
):
    """Background task for agent execution"""
    try:
        await update_execution_status(execution_id, "running")
        
        orchestrator = SDKOrchestrator()
        result = await orchestrator.execute_agent(
            agent_type=agent_type,
            issue_number=issue_number,
            mode=mode
        )
        
        await update_execution_status(execution_id, "completed", result)
        
    except Exception as e:
        await update_execution_status(execution_id, "failed", {"error": str(e)})
        raise
```

---

### 8. GitHub Actions Integration

**File**: `.github/workflows/agent-orchestrator.yml` (ENHANCED)

```yaml
# ENHANCEMENT: Add SDK service call
jobs:
  execute-agent:
    name: Execute Agent via SDK
    runs-on: ubuntu-latest
    needs: route
    if: needs.route.outputs.run_pm == 'true' || needs.route.outputs.run_architect == 'true'
    
    steps:
      - uses: actions/checkout@v4
      
      # NEW: Call SDK service instead of direct execution
      - name: Execute Agent via SDK Service
        id: sdk_execution
        run: |
          AGENT_TYPE="${{ needs.route.outputs.agent_type }}"
          ISSUE_NUMBER="${{ needs.route.outputs.issue_number }}"
          
          # Call SDK service API
          RESPONSE=$(curl -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.SDK_SERVICE_TOKEN }}" \
            -d '{
              "agent_type": "'"$AGENT_TYPE"'",
              "issue_number": '"$ISSUE_NUMBER"',
              "mode": "single"
            }' \
            https://sdk-agent-service.azurecontainerapps.io/api/v1/agents/execute)
          
          EXECUTION_ID=$(echo $RESPONSE | jq -r '.execution_id')
          echo "execution_id=$EXECUTION_ID" >> $GITHUB_OUTPUT
      
      - name: Wait for Completion
        run: |
          EXECUTION_ID="${{ steps.sdk_execution.outputs.execution_id }}"
          
          # Poll for completion (max 10 minutes)
          for i in {1..120}; do
            STATUS=$(curl -s \
              -H "Authorization: Bearer ${{ secrets.SDK_SERVICE_TOKEN }}" \
              "https://sdk-agent-service.azurecontainerapps.io/api/v1/executions/$EXECUTION_ID" \
              | jq -r '.status')
            
            if [ "$STATUS" = "completed" ]; then
              echo "✅ Agent execution completed"
              exit 0
            elif [ "$STATUS" = "failed" ]; then
              echo "❌ Agent execution failed"
              exit 1
            fi
            
            sleep 5
          done
          
          echo "⏱️ Timeout waiting for agent execution"
          exit 1
```

---

### 9. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Deployment Architecture                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────┐                                  │
│  │  GitHub Actions       │                                  │
│  │  (Orchestration)      │                                  │
│  └──────────┬────────────┘                                  │
│             │ HTTPS POST                                     │
│             ↓                                                 │
│  ┌──────────────────────┐     ┌─────────────────────────┐  │
│  │ Azure Load Balancer   │────→│ SDK Agent Service       │  │
│  └──────────────────────┘     │ (Container Apps)        │  │
│                                │ - Auto-scale (0-10)     │  │
│                                │ - CPU: 2 cores          │  │
│                                │ - Memory: 4GB           │  │
│                                └─────────┬───────────────┘  │
│                                          │                   │
│                          ┌───────────────┼───────────────┐  │
│                          ↓               ↓               ↓  │
│                  ┌────────────┐  ┌────────────┐  ┌────────────┐
│                  │ Copilot    │  │ Redis      │  │ Blob       │
│                  │ CLI        │  │ (Sessions) │  │ Storage    │
│                  │ (Managed)  │  │            │  │ (Artifacts)│
│                  └────────────┘  └────────────┘  └────────────┘
│                                                              │
│  ┌──────────────────────┐     ┌─────────────────────────┐  │
│  │ GitHub MCP Server     │     │ Custom MCP Server       │  │
│  │ (api.githubcopilot)  │     │ (AgentX operations)     │  │
│  └──────────────────────┘     └─────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Hosting Options**:

| Option | Pros | Cons | Cost |
|--------|------|------|------|
| **Azure Container Apps** (Recommended) | Auto-scale, managed, HTTPS | Setup complexity | ~$50-200/mo |
| **GitHub Actions Self-Hosted Runner** | Free, simple | No auto-scale | Runner costs |
| **Azure App Service** | Easy deployment | Less flexible | ~$75/mo |
| **Azure Kubernetes Service** | Full control | High complexity | ~$150+/mo |

**Recommendation**: Start with Azure Container Apps for production-grade auto-scaling.

---

### 10. Cost Management

**Cost Breakdown** (Estimated Monthly):

| Component | Cost Model | Estimated |
|-----------|------------|-----------|
| **Copilot SDK Requests** | Premium request quota | $0-500* |
| **Azure Container Apps** | Compute time (vCPU-sec) | $50-200 |
| **Redis Cache** | Basic tier | $15 |
| **Blob Storage** | Transaction + storage | $5 |
| **Bandwidth** | Egress | $10 |
| **Total** | | **$80-730/mo** |

*Depends on volume. With caching and optimization: $100-200/mo realistic.

**Cost Optimization Strategies**:

1. **Request Caching**:
   ```python
   # Cache agent responses for similar requests
   cache_key = f"agent:{agent_type}:issue:{issue_number}:hash:{content_hash}"
   if cached := await redis.get(cache_key):
       return cached
   ```

2. **Model Selection**:
   - Use cheaper models for simple tasks
   - Reserve expensive models (Claude Opus) for complex work

3. **Batch Processing**:
   - Process multiple issues in one session when possible

4. **Scale to Zero**:
   - Container Apps auto-scale to 0 when idle

5. **Monitoring & Alerts**:
   - Set budget alerts in Azure
   - Track premium request usage

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal**: Basic SDK service with single agent execution

**Tasks**:
1. Create `services/sdk-agent-service/` structure
2. Implement FastAPI service skeleton
3. Configure one agent (Engineer - simplest)
4. Create 2-3 executable tools
5. Deploy to Azure Container Apps (dev environment)
6. Test via GitHub Actions integration

**Success Criteria**:
- Engineer agent executes via API call
- At least 2 tools work (issue operations, code generation)
- Deployment automated via GitHub Actions

---

### Phase 2: Template System (Week 3)

**Goal**: High-quality document generation using templates

**Tasks**:
1. Implement all 5 template generators (PRD, ADR, Spec, UX, Review)
2. Create template tool for SDK
3. Test with PM and Architect agents
4. Validate template outputs against existing standards

**Success Criteria**:
- All agents use templates for document generation
- Generated docs match quality of manual examples
- Self-review validates template completeness

---

### Phase 3: Multi-Agent Conversations (Week 4-5)

**Goal**: Enable agent-to-agent collaboration

**Tasks**:
1. Implement `AgentConversation` class
2. Define conversation workflows
3. Test PM ↔ Architect ↔ UX conversation
4. Add conversation tracing and logging
5. Create conversation summarization

**Success Criteria**:
- Agents can ask clarifying questions
- Conversations stay on-topic
- Final artifacts incorporate all agent inputs

---

### Phase 4: Skills as Tools (Week 6-7)

**Goal**: Convert high-value skills to executable tools

**Tasks**:
1. Identify executable vs guidance skills
2. Implement security tools (OWASP scanning)
3. Implement testing tools (coverage, test generation)
4. Implement performance tools (profiling)
5. Create skill-to-tool mapping configuration

**Success Criteria**:
- At least 5 skills converted to tools
- Tools integrate seamlessly with agents
- Executable skills provide measurable value

---

### Phase 5: Production Hardening (Week 8-9)

**Goal**: Production-ready deployment

**Tasks**:
1. Add comprehensive error handling
2. Implement retry logic and circuit breakers
3. Add OpenTelemetry tracing
4. Set up monitoring and alerting
5. Conduct load testing
6. Create runbooks for operations

**Success Criteria**:
- 99.9% uptime
- <30s p95 latency for agent execution
- Complete observability
- Documented operational procedures

---

### Phase 6: Migration & Optimization (Week 10+)

**Goal**: Full production deployment and optimization

**Tasks**:
1. Migrate all 5 agents to SDK
2. A/B test SDK vs current approach
3. Optimize based on metrics
4. Scale based on usage patterns
5. Cost optimization
6. Documentation and training

**Success Criteria**:
- All agents running on SDK
- Performance meets or exceeds current system
- Cost within budget
- Team trained on new system

---

## Rollback Plan

**If SDK integration fails or underperforms**:

1. **Immediate Rollback** (< 1 hour):
   - Route traffic back to current GitHub Actions
   - GraphQL/MCP continue working unchanged
   - No data loss (both systems write to same GitHub Issues)

2. **Gradual Rollback** (1-2 days):
   - Disable SDK service
   - Re-enable original agent workflows
   - Export conversation logs for analysis

3. **Lessons Learned**:
   - Document what didn't work
   - Keep SDK for development/testing use cases
   - Iterate on design before next attempt

---

## Success Metrics

| Metric | Current | Target with SDK |
|--------|---------|-----------------|
| **Agent Execution Time** | 30-60s | 20-45s (with parallelization) |
| **Document Quality Score** | Manual (8/10) | Automated (9/10) |
| **Agent Collaboration** | None | 5+ conversations/day |
| **Developer Satisfaction** | Baseline | +20% improvement |
| **Cost per Issue** | $0 | <$5 (with optimization) |
| **Test Coverage** | 80% | 85%+ (automated generation) |

---

## Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|----------------|
| **Replace entire architecture with SDK** | Too risky, loses proven GraphQL performance |
| **Keep SDK only for local dev** | Misses production value (conversations, templates) |
| **Use SDK without service layer** | No scalability, no async execution |
| **Build custom LLM integration** | Reinvents wheel, SDK provides this |

---

## Consequences

### Positive

✅ **Enhanced Intelligence**: Agents collaborate, ask clarifying questions  
✅ **Template Consistency**: All docs follow standard templates  
✅ **Executable Skills**: Security scanning, testing automated  
✅ **Better Developer Experience**: Local testing without GitHub  
✅ **Future-Proof**: SDK is official GitHub product  

### Negative

⚠️ **Increased Complexity**: 4 layers instead of 3  
⚠️ **Cost Addition**: ~$100-200/mo for compute + requests  
⚠️ **Operational Overhead**: Service to monitor and maintain  
⚠️ **Technical Preview Risk**: SDK may have breaking changes  

### Mitigation

- Keep GraphQL layer for fast operations (unchanged)
- Implement comprehensive monitoring and alerting
- Budget tracking and cost alerts
- Pin SDK version, test upgrades in staging first

---

## References

- GitHub Copilot SDK: [github.com/github/copilot-sdk](https://github.com/github/copilot-sdk)
- Current Architecture: [docs/architecture-hybrid-orchestration.md](../architecture-hybrid-orchestration.md)
- Agent Workflow: [AGENTS.md](../../AGENTS.md)
- Skills: [Skills.md](../../Skills.md)

---

**Decision Date**: TBD  
**Review Date**: Q2 2026 (after SDK reaches GA)
