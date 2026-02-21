# AgentX Collections

Collections are distributable bundles of AgentX artifacts (agents, instructions, skills, templates, workflows) that can be selectively installed into any project.

## What is a Collection?

A collection is a `manifest.json` file that declares which artifacts belong together. Collections enable:

- **Modular distribution** -- install only what you need
- **Versioned bundles** -- track which version of each collection is installed
- **Dependency management** -- collections can depend on other collections
- **Selective updates** -- update one collection without affecting others

## Collection Structure

```
collections/
  agentx-core/
    manifest.json     # Core SDLC agents + instructions + workflows
  agentx-ai/
    manifest.json     # AI/ML specific agents + skills (future)
  agentx-cloud/
    manifest.json     # Cloud infrastructure skills (future)
```

## Manifest Schema

Each collection has a `manifest.json` validated against `.github/schemas/collection-manifest.schema.json`.

```json
{
  "name": "agentx-core",
  "version": "5.3.0",
  "description": "Core SDLC agents and workflow engine.",
  "maturity": "stable",
  "tags": ["sdlc", "orchestration"],
  "artifacts": {
    "agents": [".github/agents/agent-x.agent.md", "..."],
    "instructions": [".github/instructions/ai.instructions.md", "..."],
    "templates": [".github/templates/PRD-TEMPLATE.md", "..."],
    "workflows": [".agentx/workflows/epic.toml", "..."],
    "scripts": [".agentx/agentx.ps1", "..."]
  },
  "dependencies": []
}
```

## Maturity Levels

| Level | Meaning |
|-------|---------|
| `stable` | Production-ready, fully tested |
| `preview` | Feature-complete, undergoing validation |
| `experimental` | Early development, may change |
| `deprecated` | Scheduled for removal |

## Available Collections

| Collection | Description | Maturity |
|------------|-------------|----------|
| `agentx-core` | Full SDLC agents, workflow engine, instructions | stable |

## Future Collections (Planned)

| Collection | Description | Status |
|------------|-------------|--------|
| `agentx-ai` | AI agent development, RAG, evaluation skills | Planned |
| `agentx-cloud` | Azure/AWS/GCP infrastructure skills | Planned |
| `agentx-security` | Security scanning and compliance skills | Planned |
| `agentx-data` | Data pipeline and analytics skills | Planned |
