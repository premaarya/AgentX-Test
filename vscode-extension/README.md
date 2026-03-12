# AgentX for VS Code

**The IDE Orchestrator for Multi-Agent Software Delivery**

[![Version](https://img.shields.io/badge/Version-8.2.8-0EA5E9?style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=jnPiyush.agentx)
[![License](https://img.shields.io/badge/License-Apache_2.0-22C55E?style=for-the-badge)](LICENSE)

*Bring structured multi-agent workflows directly into your editor with chat execution, live workspace state, and seamless repo integration.*

---

## Why Use the Extension?

Running autonomous agents from the CLI lacks visibility. The AgentX VS Code extension bridges the gap, allowing you to trigger complex delivery pipelines while retaining absolute visibility and control over what the agents are thinking, validating, and writing.

> **"Full autonomous orchestration, deeply integrated with your local workspace."**

---

## The Extension Surface

| Feature | Description |
|:--------|:------------|
| **Copilot Chat Integration** | Native chat participant for triggering AgentX routines seamlessly. |
| **Workspace Setup Wizard** | Single-click initialization of local, GitHub, or Azure DevOps setups. |
| **Live Sidebar Views** | Instantly visualize queues, active workflows, agent roles, and output templates. |
| **Quality & Integration Gates** | Sidebar dashboards that track loop states, unresolved dependencies, and constraints. |
| **Command Palette Access** | Fast workflow-oriented actions like Status sync, Ready Queue checks, and Digests. |

---

## Architecture Flow

```mermaid
flowchart LR
    classDef chat fill:#fdf4ff,stroke:#d946ef,stroke-width:2px,color:#701a75
    classDef core fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e40af
    classDef repo fill:#f0fdf4,stroke:#22c55e,stroke-width:2px,color:#166534

    Chat([Copilot Chat]):::chat --> Context[AgentX Context]:::core --> Engine[Execution Engine]:::core
    
    Engine --> View[Sidebar & Live State]
    Engine --> File[Repo-Defined Assets]:::repo
    
    View -.->|Queues & Workflows| UI((VS Code UI))
    File -.->|Skills & Templates| Workspace((Local Files))
```

* **Inputs:** VS Code Chat drives intent into the orchestrator.
* **Control:** The IDE tracks progress and state live via dedicated UI extensions.
* **Outputs:** Everything resolves natively into your repository as standard Markdown tracking, code, and CI manifests.

---

## Requirements

To run AgentX successfully within VS Code:

- **VS Code:** 1.85.0 or newer
- **System:** Git configured on your PATH
- **Runtime:** PowerShell 7.4+ (`pwsh`) on Windows, or Bash on Linux/macOS
- **Integrations:** gh (GitHub CLI) optional for extended GitHub mode operations

---

## Quick Start

1. **Install** the extension from the VS Code Marketplace.
2. **Open** to your target project workspace.
3. **Initialize** the environment by running AgentX: Initialize Project in the Command Palette.
4. **Deploy work** by invoking AgentX dynamically from Copilot Chat or picking from the AgentX sidebar queues!

---

## Learn More

- [AgentX Core Repository](https://github.com/jnPiyush/AgentX)
- [AGENTS.md & Routing Setup](https://github.com/jnPiyush/AgentX/blob/master/AGENTS.md)
- [Detailed Workflow Guide](https://github.com/jnPiyush/AgentX/blob/master/docs/WORKFLOW.md)
- [Full Setup Instructions](https://github.com/jnPiyush/AgentX/blob/master/docs/GUIDE.md)
