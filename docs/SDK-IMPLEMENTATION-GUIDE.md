# GitHub Copilot SDK Implementation Guide

> **Purpose**: Step-by-step guide to implement SDK-powered AgentX agents  
> **Audience**: Development Team  
> **Related**: [ADR-SDK-INTEGRATION.md](adr/ADR-SDK-INTEGRATION.md)

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Service Setup](#service-setup)
3. [Agent Configuration](#agent-configuration)
4. [Template Integration](#template-integration)
5. [Multi-Agent Conversations](#multi-agent-conversations)
6. [Deployment](#deployment)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

```bash
# Required
- Python 3.11+
- GitHub Copilot subscription
- Azure account (for production deployment)

# Install dependencies
pip install github-copilot-sdk fastapi uvicorn redis aiohttp
```

### 5-Minute Demo

```python
# demo/simple_agent.py
"""Simplest possible SDK agent example"""
import asyncio
from copilot import CopilotClient

async def main():
    # 1. Create client
    client = CopilotClient()
    await client.start()
    
    # 2. Define agent
    session = await client.create_session({
        "custom_agents": [{
            "name": "demo-agent",
            "prompt": "You are a helpful software architect.",
        }],
        "model": "gpt-5.1"
    })
    
    # 3. Execute
    result = await session.send_and_wait({
        "prompt": "Design a REST API for user authentication"
    })
    
    print(result.data.content)
    
    await client.stop()

asyncio.run(main())
```

Run:
```bash
python demo/simple_agent.py
```

---

## Service Setup

### Directory Structure

```bash
# Create service directory
mkdir -p services/sdk-agent-service/{agents,tools,skills,templates,workflows,config,tests}

cd services/sdk-agent-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### requirements.txt

```txt
# Core
github-copilot-sdk>=0.1.16
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
pydantic>=2.5.0

# Infrastructure
redis>=5.0.1
aiohttp>=3.9.1
python-multipart>=0.0.6

# Monitoring
opentelemetry-api>=1.22.0
opentelemetry-sdk>=1.22.0
opentelemetry-instrumentation-fastapi>=0.43b0

# Development
pytest>=7.4.3
pytest-asyncio>=0.23.2
httpx>=0.26.0  # For testing
black>=23.12.1
ruff>=0.1.9
```

### Basic FastAPI Service

**File**: `services/sdk-agent-service/main.py`

```python
"""AgentX SDK Service - Main Application"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import asyncio
import uuid
from datetime import datetime

app = FastAPI(
    title="AgentX SDK Agent Service",
    description="Copilot SDK-powered agent execution service",
    version="1.0.0"
)

# CORS for GitHub Actions
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://github.com", "https://api.github.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage (replace with Redis in production)
executions: Dict[str, Dict] = {}

# ============================================================================
# Models
# ============================================================================

class AgentExecutionRequest(BaseModel):
    agent_type: str  # pm, architect, ux, engineer, reviewer
    issue_number: int
    mode: str = "single"  # single, conversation
    participants: Optional[List[str]] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "agent_type": "engineer",
                "issue_number": 123,
                "mode": "single"
            }
        }

class AgentExecutionResponse(BaseModel):
    execution_id: str
    status: str
    agent: str
    issue_number: int
    created_at: str

class ExecutionStatus(BaseModel):
    execution_id: str
    status: str  # queued, running, completed, failed
    agent: str
    issue_number: int
    created_at: str
    updated_at: str
    result: Optional[Dict] = None
    error: Optional[str] = None

# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "AgentX SDK Agent Service",
        "version": "1.0.0",
        "status": "operational"
    }

@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "active_executions": len([e for e in executions.values() if e["status"] == "running"])
    }

@app.post("/api/v1/agents/execute", response_model=AgentExecutionResponse)
async def execute_agent(
    request: AgentExecutionRequest,
    background_tasks: BackgroundTasks
):
    """
    Execute an agent asynchronously
    
    This endpoint is called by GitHub Actions workflow to trigger agent execution.
    """
    # Generate execution ID
    execution_id = str(uuid.uuid4())
    
    # Create execution record
    execution = {
        "execution_id": execution_id,
        "status": "queued",
        "agent": request.agent_type,
        "issue_number": request.issue_number,
        "mode": request.mode,
        "participants": request.participants,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "result": None,
        "error": None
    }
    
    executions[execution_id] = execution
    
    # Queue execution in background
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
        issue_number=request.issue_number,
        created_at=execution["created_at"]
    )

@app.get("/api/v1/executions/{execution_id}", response_model=ExecutionStatus)
async def get_execution_status(execution_id: str):
    """Get execution status and results"""
    if execution_id not in executions:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    return ExecutionStatus(**executions[execution_id])

@app.get("/api/v1/executions")
async def list_executions(
    status: Optional[str] = None,
    agent: Optional[str] = None,
    limit: int = 50
):
    """List recent executions with optional filters"""
    filtered = executions.values()
    
    if status:
        filtered = [e for e in filtered if e["status"] == status]
    
    if agent:
        filtered = [e for e in filtered if e["agent"] == agent]
    
    # Sort by created_at descending
    sorted_executions = sorted(
        filtered,
        key=lambda x: x["created_at"],
        reverse=True
    )
    
    return {
        "executions": sorted_executions[:limit],
        "total": len(sorted_executions)
    }

# ============================================================================
# Background Task
# ============================================================================

async def run_agent_execution(
    execution_id: str,
    agent_type: str,
    issue_number: int,
    mode: str,
    participants: Optional[List[str]] = None
):
    """
    Background task for agent execution
    
    This runs the actual agent logic using Copilot SDK.
    """
    try:
        # Update status to running
        executions[execution_id]["status"] = "running"
        executions[execution_id]["updated_at"] = datetime.utcnow().isoformat()
        
        # Import orchestrator (lazy import to avoid startup delays)
        from workflows.orchestrator import SDKOrchestrator
        
        # Execute agent
        orchestrator = SDKOrchestrator()
        result = await orchestrator.execute_agent(
            agent_type=agent_type,
            issue_number=issue_number,
            mode=mode
        )
        
        # Update status to completed
        executions[execution_id]["status"] = "completed"
        executions[execution_id]["result"] = result
        executions[execution_id]["updated_at"] = datetime.utcnow().isoformat()
        
    except Exception as e:
        # Update status to failed
        executions[execution_id]["status"] = "failed"
        executions[execution_id]["error"] = str(e)
        executions[execution_id]["updated_at"] = datetime.utcnow().isoformat()
        
        # Log error (use proper logging in production)
        print(f"❌ Execution {execution_id} failed: {e}")
        raise

# ============================================================================
# Startup/Shutdown
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize service on startup"""
    print("🚀 AgentX SDK Agent Service starting...")
    # TODO: Initialize Redis connection
    # TODO: Load agent configurations
    # TODO: Warm up SDK client
    print("✅ Service ready")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    print("🛑 AgentX SDK Agent Service shutting down...")
    # TODO: Close Redis connection
    # TODO: Cleanup SDK sessions
    print("✅ Shutdown complete")

# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Development only
        log_level="info"
    )
```

### Run Locally

```bash
# Development server with auto-reload
python main.py

# Or with uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Test health endpoint
curl http://localhost:8000/api/v1/health

# Test agent execution
curl -X POST http://localhost:8000/api/v1/agents/execute \
  -H "Content-Type: application/json" \
  -d '{
    "agent_type": "engineer",
    "issue_number": 123,
    "mode": "single"
  }'
```

---

## Agent Configuration

### Agent Config File

**File**: `services/sdk-agent-service/config/agents.yaml`

```yaml
# Agent configurations for AgentX
# Each agent has: prompt, tools, skills, model settings

agents:
  # ============================================================================
  # Product Manager Agent
  # ============================================================================
  product_manager:
    name: "product-manager"
    display_name: "Product Manager"
    description: "Creates PRDs and decomposes epics into features/stories"
    
    # Prompt from existing agent definition
    prompt_file: "../../.github/agents/pm.agent.md"
    
    # Tools available to this agent
    tools:
      - github_create_issue
      - github_add_label
      - github_add_comment
      - generate_prd
      - research_codebase
      
    # Skills loaded from .github/skills/
    skills:
      - code-organization
      - documentation
      - api-design
      
    # Model configuration
    model:
      name: "gpt-5.1"
      temperature: 0.3
      max_tokens: 8000
      
    # Self-review checklist
    review_checklist:
      - "PRD created using template"
      - "User stories are clear and testable"
      - "Acceptance criteria defined"
      - "Features and stories created"
      - "No duplicate issues"
      
  # ============================================================================
  # Software Engineer Agent
  # ============================================================================
  engineer:
    name: "engineer"
    display_name: "Software Engineer"
    description: "Implements code with tests following technical specifications"
    
    prompt_file: "../../.github/agents/engineer.agent.md"
    
    tools:
      - github_create_pr
      - generate_code
      - generate_tests
      - run_tests
      - security_scan
      - lint_code
      
    skills:
      - testing
      - security
      - error-handling
      - performance
      - type-safety
      - code-organization
      
    model:
      name: "gpt-5.1-codex-max"  # Best for coding
      temperature: 0.1  # Deterministic code generation
      max_tokens: 12000
      
    review_checklist:
      - "Code follows specs exactly"
      - "Tests written (≥80% coverage)"
      - "Security scan passed"
      - "No compiler warnings"
      - "Documentation updated"
      
  # ============================================================================
  # Solution Architect Agent
  # ============================================================================
  architect:
    name: "architect"
    display_name: "Solution Architect"
    description: "Creates ADRs and technical specifications"
    
    prompt_file: "../../.github/agents/architect.agent.md"
    
    tools:
      - generate_adr
      - generate_spec
      - analyze_codebase
      - diagram_generator
      
    skills:
      - core-principles
      - scalability
      - security
      - performance
      - database
      - api-design
      
    model:
      name: "claude-opus-4-5"  # Best for architecture
      temperature: 0.2
      max_tokens: 16000
      
    review_checklist:
      - "ADR follows template"
      - "Technical feasibility validated"
      - "Alternatives considered"
      - "Spec is implementable"
      - "Security reviewed"
```

### Loading Agent Config

**File**: `services/sdk-agent-service/agents/loader.py`

```python
"""Agent Configuration Loader"""
import yaml
from pathlib import Path
from typing import Dict
from copilot import CustomAgentConfig

class AgentConfigLoader:
    """Load and manage agent configurations"""
    
    def __init__(self, config_path: str = "config/agents.yaml"):
        self.config_path = Path(config_path)
        self.agents = self._load_config()
    
    def _load_config(self) -> Dict:
        """Load agents.yaml configuration"""
        with open(self.config_path) as f:
            config = yaml.safe_load(f)
        return config["agents"]
    
    def get_agent_config(self, agent_type: str) -> CustomAgentConfig:
        """
        Get SDK CustomAgentConfig for an agent
        
        Args:
            agent_type: pm, architect, engineer, ux, reviewer
            
        Returns:
            CustomAgentConfig ready for SDK session
        """
        # Map agent_type to config key
        agent_map = {
            "pm": "product_manager",
            "architect": "architect",
            "engineer": "engineer",
            "ux": "ux_designer",
            "reviewer": "reviewer"
        }
        
        config_key = agent_map.get(agent_type)
        if not config_key or config_key not in self.agents:
            raise ValueError(f"Unknown agent type: {agent_type}")
        
        agent_config = self.agents[config_key]
        
        # Load prompt from file
        prompt = self._load_prompt(agent_config["prompt_file"])
        
        return CustomAgentConfig(
            name=agent_config["name"],
            display_name=agent_config["display_name"],
            description=agent_config["description"],
            prompt=prompt,
            tools=agent_config.get("tools"),
            # Skills loaded separately via skill_directories
        )
    
    def _load_prompt(self, prompt_file: str) -> str:
        """Load agent prompt from markdown file"""
        prompt_path = Path(prompt_file)
        if not prompt_path.exists():
            raise FileNotFoundError(f"Prompt file not found: {prompt_file}")
        
        with open(prompt_path) as f:
            return f.read()
    
    def get_model_config(self, agent_type: str) -> Dict:
        """Get model configuration for agent"""
        agent_map = {"pm": "product_manager", "architect": "architect", "engineer": "engineer"}
        config_key = agent_map.get(agent_type, agent_type)
        
        if config_key not in self.agents:
            return {"name": "gpt-5.1", "temperature": 0.3}
        
        return self.agents[config_key].get("model", {})
    
    def get_review_checklist(self, agent_type: str) -> list:
        """Get self-review checklist for agent"""
        agent_map = {"pm": "product_manager", "architect": "architect", "engineer": "engineer"}
        config_key = agent_map.get(agent_type, agent_type)
        
        if config_key not in self.agents:
            return []
        
        return self.agents[config_key].get("review_checklist", [])


# Usage
loader = AgentConfigLoader()
agent_config = loader.get_agent_config("engineer")
model_config = loader.get_model_config("engineer")
```

---

## Template Integration

### Template Tool Implementation

**File**: `services/sdk-agent-service/templates/document_generator.py`

```python
"""Template-Based Document Generation Tools"""
from copilot import defineTool
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import os

class TemplateGenerator:
    """Generate documents using AgentX standard templates"""
    
    def __init__(self, templates_dir: str = "../../.github/templates"):
        self.templates_dir = Path(templates_dir)
    
    def load_template(self, template_name: str) -> str:
        """Load template content"""
        template_path = self.templates_dir / template_name
        with open(template_path) as f:
            return f.read()
    
    async def generate_prd(
        self,
        issue_number: int,
        title: str,
        description: str,
        user_stories: List[str],
        acceptance_criteria: List[Dict],
        technical_constraints: Optional[List[str]] = None,
        success_metrics: Optional[List[str]] = None
    ) -> Dict:
        """
        Generate PRD using standard template
        
        Template: .github/templates/PRD-TEMPLATE.md
        Output: docs/prd/PRD-{issue}.md
        """
        template = self.load_template("PRD-TEMPLATE.md")
        
        # Format user stories
        stories_md = "\n".join(f"- {story}" for story in user_stories)
        
        # Format acceptance criteria
        ac_md = "\n\n".join(
            f"**{ac['feature']}:**\n{ac['criteria']}"
            for ac in acceptance_criteria
        )
        
        # Format constraints
        constraints_md = "\n".join(f"- {c}" for c in (technical_constraints or []))
        
        # Format metrics
        metrics_md = "\n".join(f"- {m}" for m in (success_metrics or []))
        
        # Fill template
        prd_content = template.replace("{{issue_number}}", str(issue_number))
        prd_content = prd_content.replace("{{title}}", title)
        prd_content = prd_content.replace("{{description}}", description)
        prd_content = prd_content.replace("{{user_stories}}", stories_md)
        prd_content = prd_content.replace("{{acceptance_criteria}}", ac_md)
        prd_content = prd_content.replace("{{constraints}}", constraints_md)
        prd_content = prd_content.replace("{{metrics}}", metrics_md)
        prd_content = prd_content.replace("{{date}}", datetime.now().strftime("%B %d, %Y"))
        
        # Write to file
        output_path = Path(f"docs/prd/PRD-{issue_number}.md")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w") as f:
            f.write(prd_content)
        
        return {
            "success": True,
            "file_path": str(output_path),
            "content": prd_content,
            "word_count": len(prd_content.split())
        }


# Create SDK tools
generator = TemplateGenerator()

@defineTool(description="Generate Product Requirements Document using standard template")
async def generate_prd_tool(
    issue_number: int,
    title: str,
    description: str,
    user_stories: List[str],
    acceptance_criteria: List[Dict]
) -> Dict:
    """
    PRD Generation Tool for SDK agents
    
    Example usage in agent prompt:
    ```
    Use generate_prd_tool to create a PRD with:
    - issue_number: 123
    - title: "User Authentication System"
    - description: "..."
    - user_stories: ["As a user, I want to...", ...]
    - acceptance_criteria: [{"feature": "Login", "criteria": "..."}]
    ```
    """
    return await generator.generate_prd(
        issue_number=issue_number,
        title=title,
        description=description,
        user_stories=user_stories,
        acceptance_criteria=acceptance_criteria
    )

@defineTool(description="Generate Architecture Decision Record using standard template")
async def generate_adr_tool(
    issue_number: int,
    title: str,
    context: str,
    decision: str,
    consequences: Dict[str, List[str]]  # {"positive": [...], "negative": [...]}
) -> Dict:
    """ADR Generation Tool"""
    template = generator.load_template("ADR-TEMPLATE.md")
    
    # Format consequences
    positive = "\n".join(f"- {c}" for c in consequences.get("positive", []))
    negative = "\n".join(f"- {c}" for c in consequences.get("negative", []))
    
    adr_content = template.replace("{{issue_number}}", str(issue_number))
    adr_content = adr_content.replace("{{title}}", title)
    adr_content = adr_content.replace("{{context}}", context)
    adr_content = adr_content.replace("{{decision}}", decision)
    adr_content = adr_content.replace("{{positive}}", positive)
    adr_content = adr_content.replace("{{negative}}", negative)
    adr_content = adr_content.replace("{{date}}", datetime.now().strftime("%B %d, %Y"))
    
    output_path = Path(f"docs/adr/ADR-{issue_number}.md")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w") as f:
        f.write(adr_content)
    
    return {"success": True, "file_path": str(output_path), "content": adr_content}
```

### Register Tools with Agent

```python
# In workflows/orchestrator.py
from templates.document_generator import generate_prd_tool, generate_adr_tool

def get_tools_for_agent(agent_type: str):
    """Return SDK tools based on agent type"""
    tools_map = {
        "pm": [
            generate_prd_tool,
            # ... other PM tools
        ],
        "architect": [
            generate_adr_tool,
            generate_spec_tool,
            # ... other architect tools
        ],
        "engineer": [
            generate_code_tool,
            generate_tests_tool,
            # ... other engineer tools
        ]
    }
    
    return tools_map.get(agent_type, [])
```

---

## Multi-Agent Conversations

### Conversation Implementation

**File**: `services/sdk-agent-service/workflows/conversation.py`

```python
"""Multi-Agent Conversation Engine"""
from copilot import CopilotClient, CustomAgentConfig
from agents.loader import AgentConfigLoader
from typing import List, Dict
import json

class AgentConversation:
    """
    Manages multi-agent conversations for complex tasks
    
    Use Cases:
    - PM asks Architect for technical feasibility
    - Engineer asks UX for design clarifications
    - Architect asks PM to clarify requirements
    """
    
    def __init__(self, issue_number: int, participants: List[str]):
        self.issue_number = issue_number
        self.participants = participants  # ["pm", "architect", "ux"]
        self.client = None
        self.session = None
        self.conversation_log = []
        self.loader = AgentConfigLoader()
    
    async def start(self):
        """Initialize SDK session with multiple agents"""
        self.client = CopilotClient()
        await self.client.start()
        
        # Load configurations for all participants
        agent_configs = [
            self.loader.get_agent_config(agent_type)
            for agent_type in self.participants
        ]
        
        # Create session with all agents
        self.session = await self.client.create_session({
            "model": "gpt-5.1",
            "custom_agents": agent_configs,
            "skill_directories": ["../../.github/skills"],
            "mcp_servers": {
                "github": {
                    "type": "http",
                    "url": "https://api.githubcopilot.com/mcp/"
                }
            },
            "system_message": {
                "mode": "append",
                "content": self._build_conversation_context()
            }
        })
        
        # Listen for subagent events
        self.session.on(self._log_event)
    
    def _build_conversation_context(self) -> str:
        """Build conversation context"""
        return f"""
<conversation>
<issue>#{self.issue_number}</issue>
<repository>jnPiyush/AgentX</repository>
<participants>
{self._format_participants()}
</participants>

<objective>
Collaborate to produce high-quality deliverables for issue #{self.issue_number}.
Each agent contributes their expertise. Ask clarifying questions when needed.
</objective>

<workflow>
1. Research the issue thoroughly
2. Discuss approach among participants
3. Ask clarifying questions
4. Reach consensus on approach
5. Create deliverables using templates
6. Self-review before completion
</workflow>

<rules>
- Follow AGENTS.md workflow strictly
- Use templates for all documents
- All agents must approve final output
- Document disagreements and resolutions
</rules>
</conversation>
"""
    
    def _format_participants(self) -> str:
        """Format participant list"""
        agent_names = {
            "pm": "Product Manager",
            "architect": "Solution Architect",
            "ux": "UX Designer",
            "engineer": "Software Engineer",
            "reviewer": "Code Reviewer"
        }
        
        return "\n".join(
            f"- {agent_names.get(p, p)}: {self.loader.agents.get(p, {}).get('description', '')}"
            for p in self.participants
        )
    
    async def run(self, initial_task: str) -> Dict:
        """
        Execute multi-agent conversation
        
        Args:
            initial_task: Task description for agents to work on
            
        Returns:
            Conversation result with artifacts
        """
        # Start conversation
        prompt = f"""
{initial_task}

Instructions for agents:
1. {self.participants[0]}: Start by analyzing the task
2. Ask other agents for their input
3. Collaborate until you reach consensus
4. Execute the work with all agents contributing
5. Self-review as a team before marking complete
"""
        
        result = await self.session.send_and_wait({"prompt": prompt})
        
        return {
            "success": True,
            "conversation_id": self.session.session_id,
            "participants": self.participants,
            "final_output": result.data.content,
            "conversation_log": self.conversation_log,
            "artifacts": self._extract_artifacts()
        }
    
    def _log_event(self, event):
        """Log conversation events"""
        self.conversation_log.append({
            "type": event.type,
            "timestamp": event.timestamp,
            "data": event.data.__dict__ if hasattr(event.data, '__dict__') else str(event.data)
        })
    
    def _extract_artifacts(self) -> List[Dict]:
        """Extract generated files from conversation"""
        artifacts = []
        for log in self.conversation_log:
            if log["type"] == "tool.execution_complete":
                # Check if tool generated a file
                if "file_path" in str(log["data"]):
                    artifacts.append(log)
        return artifacts
    
    async def close(self):
        """Clean up conversation"""
        if self.session:
            await self.session.destroy()
        if self.client:
            await self.client.stop()


# Example: PM + Architect conversation for Epic
async def pm_architect_collaboration(issue_number: int):
    """
    PM and Architect collaborate on Epic planning
    
    Flow:
    1. PM drafts PRD
    2. Architect reviews for technical feasibility
    3. PM addresses concerns
    4. Architect creates ADR
    5. Both approve final plan
    """
    conversation = AgentConversation(
        issue_number=issue_number,
        participants=["pm", "architect"]
    )
    
    await conversation.start()
    
    result = await conversation.run(f"""
    Epic Planning for Issue #{issue_number}
    
    Product Manager:
    1. Create initial PRD based on issue description
    2. Present PRD to Architect
    3. Ask: "Is this technically feasible? Any concerns?"
    
    Architect:
    1. Review PRD for technical feasibility
    2. Identify technical risks/challenges
    3. Ask PM clarifying questions if needed
    4. Suggest technical approach
    5. Create ADR documenting architecture decisions
    
    Both:
    - Discuss and resolve any concerns
    - Finalize PRD and ADR
    - Ensure alignment before proceeding
    """)
    
    await conversation.close()
    
    return result
```

### Usage in Orchestrator

```python
# In workflows/orchestrator.py

async def execute_epic_planning(issue_number: int):
    """Execute Epic with multi-agent conversation"""
    from workflows.conversation import pm_architect_collaboration
    
    # Step 1: PM + Architect collaborate
    result = await pm_architect_collaboration(issue_number)
    
    # Step 2: Add UX if needed
    if has_ui_components(result):
        ux_result = await add_ux_to_conversation(issue_number, result)
    
    # Step 3: Break down into features/stories
    # ... rest of workflow
    
    return result
```

---

## Deployment

### Docker Configuration

**File**: `services/sdk-agent-service/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Azure Container Apps Deployment

**File**: `services/sdk-agent-service/deploy/azure-container-app.yaml`

```yaml
# Azure Container Apps configuration
apiVersion: apps/v1
kind: ContainerApp
metadata:
  name: agentx-sdk-service
spec:
  containers:
    - name: sdk-service
      image: ghcr.io/jnpiyush/agentx-sdk-service:latest
      resources:
        cpu: 2.0
        memory: 4Gi
      env:
        - name: COPILOT_CLI_PATH
          value: "/usr/local/bin/copilot"
        - name: GITHUB_TOKEN
          secretRef: github-token
        - name: REDIS_URL
          secretRef: redis-url
      ports:
        - containerPort: 8000
          protocol: TCP
  
  ingress:
    external: true
    targetPort: 8000
    allowInsecure: false
  
  scale:
    minReplicas: 0  # Scale to zero when idle
    maxReplicas: 10
    rules:
      - name: http-rule
        http:
          metadata:
            concurrentRequests: "10"
```

### Deploy Script

```bash
#!/bin/bash
# deploy/deploy.sh

# Build Docker image
docker build -t ghcr.io/jnpiyush/agentx-sdk-service:latest .

# Push to GitHub Container Registry
docker push ghcr.io/jnpiyush/agentx-sdk-service:latest

# Deploy to Azure Container Apps
az containerapp update \
  --name agentx-sdk-service \
  --resource-group agentx-prod \
  --image ghcr.io/jnpiyush/agentx-sdk-service:latest
```

---

## Testing

### Unit Tests

**File**: `services/sdk-agent-service/tests/test_agents.py`

```python
"""Test agent execution"""
import pytest
from workflows.orchestrator import SDKOrchestrator

@pytest.mark.asyncio
async def test_engineer_agent_basic():
    """Test engineer agent can execute"""
    orchestrator = SDKOrchestrator()
    
    # Mock issue for testing
    result = await orchestrator.execute_agent(
        agent_type="engineer",
        issue_number=999,
        mode="single"
    )
    
    assert result["success"] == True
    assert result["agent"] == "engineer"
    assert "artifacts" in result

@pytest.mark.asyncio
async def test_conversation_mode():
    """Test multi-agent conversation"""
    from workflows.conversation import AgentConversation
    
    conversation = AgentConversation(
        issue_number=999,
        participants=["pm", "architect"]
    )
    
    await conversation.start()
    
    result = await conversation.run("Test collaboration")
    
    assert len(result["conversation_log"]) > 0
    await conversation.close()
```

### Integration Tests

```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_agents.py -v

# Run with coverage
pytest tests/ --cov=. --cov-report=html
```

---

## Troubleshooting

### Common Issues

**1. SDK Client Connection Fails**
```python
Error: Cannot connect to Copilot CLI

Solution:
- Ensure Copilot CLI installed: copilot --version
- Check authentication: copilot auth status
- Verify PATH includes Copilot CLI
```

**2. Agent Timeout**
```python
Error: Agent execution timeout after 300s

Solution:
- Increase timeout in orchestrator
- Check if agent is stuck in infinite loop
- Review agent prompt for clarity
```

**3. Template Not Found**
```python
Error: FileNotFoundError: PRD-TEMPLATE.md

Solution:
- Verify template exists at .github/templates/
- Check file path is relative to service root
- Ensure templates are included in Docker image
```

**4. High Cost**
```python
Issue: Premium request quota exhausted

Solution:
- Implement response caching
- Use cheaper models for simple tasks
- Batch similar requests
- Monitor usage dashboard
```

---

## Next Steps

1. ✅ Complete service setup (this guide)
2. 📝 Implement 2-3 agents (start with Engineer)
3. 🧪 Test locally with sample issues
4. 🚀 Deploy to Azure Container Apps (staging)
5. 📊 Monitor performance and costs
6. 🔄 Iterate based on metrics
7. 🎯 Migrate remaining agents

---

## Support

- **Documentation**: [ADR-SDK-INTEGRATION.md](adr/ADR-SDK-INTEGRATION.md)
- **Issues**: Create issue with `type:docs` label
- **Questions**: Open GitHub Discussion

---

**Last Updated**: January 22, 2026
