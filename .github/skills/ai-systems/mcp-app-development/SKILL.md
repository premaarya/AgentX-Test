````skill
---
name: "mcp-app-development"
description: 'Build interactive MCP Apps - Model Context Protocol servers that expose both tools and a bundled UI resource rendered as a sandboxed iframe inside MCP hosts (Claude, VS Code GitHub Copilot, Goose). Uses @modelcontextprotocol/ext-apps SDK. Covers registerAppTool/registerAppResource patterns, bidirectional App class communication, Vite bundling, StreamableHTTPServerTransport, and security model. Use when building dashboards, data visualizations, forms, or any rich interactive UI delivered through an MCP server.'
metadata:
 author: "AgentX"
 version: "1.0.0"
 created: "2026-03-03"
 updated: "2026-03-03"
compatibility:
 languages: ["typescript", "javascript", "html", "css"]
 frameworks: ["mcp-ext-apps", "vite", "express", "react", "vue", "svelte"]
 platforms: ["windows", "linux", "macos"]
prerequisites:
 - "Node.js 18 or higher"
 - "@modelcontextprotocol/ext-apps package (NOT just the base SDK)"
 - "@modelcontextprotocol/sdk package"
 - "Vite + vite-plugin-singlefile for bundling UI into a single HTML file"
 - "MCP host that supports MCP Apps: Claude, VS Code GitHub Copilot, Goose, Postman"
allowed-tools: "read_file run_in_terminal create_file replace_string_in_file semantic_search web_search"
---

# MCP App Development

> Build production-quality Model Context Protocol applications that connect AI agents to real-time data and actions through a standardized JSON-RPC 2.0 protocol.

## When to Use

- Building dashboards, charts, or compliance visualizations inside an AI conversation
- Creating interactive forms or multi-step approval workflows directly in chat
- Viewing rich hierarchical data (org -> team -> repo -> branch drill-down) without leaving context
- Building real-time monitors (live GitHub compliance metrics, live alert feeds)
- Exposing GitHub Enterprise org data as both MCP tools (for AI agents) and interactive UI (for users)

## MCP App vs Regular MCP Server

| Aspect | MCP Server (base SDK) | MCP App (ext-apps) |
|--------|----------------------|--------------------|
| Output type | Text, images, structured data | Interactive HTML UI in sandboxed iframe |
| Transport | stdio or SSE | `StreamableHTTPServerTransport` (HTTP required) |
| Package | `@modelcontextprotocol/sdk` only | `+ @modelcontextprotocol/ext-apps` |
| Tool registration | `server.tool(...)` | `registerAppTool(server, ...)` + `_meta.ui.resourceUri` |
| UI interaction | None | `App` class: `ontoolresult` + `callServerTool()` |
| Build step | None (run directly) | `vite build` required to generate `dist/mcp-app.html` |

## ext-apps SDK (Interactive UI Apps)

The `@modelcontextprotocol/ext-apps` package extends the base SDK with interactive HTML UI support.

### Install

```bash
npm install @modelcontextprotocol/ext-apps @modelcontextprotocol/sdk
npm install -D typescript vite vite-plugin-singlefile express cors @types/express @types/cors tsx
```

### server.ts - Register App Tool and Resource

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const server = new McpServer({ name: "compliance-dashboard", version: "1.0.0" });
const resourceUri = "ui://compliance-dashboard/mcp-app.html";

// _meta.ui.resourceUri is the key differentiator that makes this an MCP App
registerAppTool(server, "show-compliance-dashboard", {
  title: "Compliance Dashboard",
  description: "Interactive GitHub Enterprise org compliance dashboard with repo drill-down.",
  inputSchema: { org: z.string().describe("GitHub org slug") },
  _meta: { ui: { resourceUri } },
}, async ({ org }) => {
  const data = await getComplianceSummary(org);  // fetch from GitHub API
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});

// Serve the compiled UI HTML when the host requests the resource
registerAppResource(server, resourceUri, resourceUri, { mimeType: RESOURCE_MIME_TYPE }, async () => {
  const html = await fs.readFile(path.join(import.meta.dirname, "dist", "mcp-app.html"), "utf-8");
  return { contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
});

// Drill-down tool (called from UI via callServerTool - no UI resource needed)
server.tool("get-repo-compliance", { repo: z.string(), owner: z.string() }, async ({ owner, repo }) => ({
  content: [{ type: "text", text: JSON.stringify(await checkRepoCompliance(owner, repo)) }],
}));

const app = express();
app.use(cors());
app.use(express.json());
app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
app.listen(3001, () => console.log("MCP App: http://localhost:3001/mcp"));
```

### src/mcp-app.ts - UI Communication

```typescript
import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "Compliance Dashboard", version: "1.0.0" });

// Establish postMessage channel with the host (call once on init)
app.connect();

// Receive initial tool result pushed by host when UI renders
app.ontoolresult = (result) => {
  const data = JSON.parse(result.content?.find(c => c.type === "text")?.text ?? "{}");
  renderDashboard(data);
};

// Proactive tool call from UI event (e.g., user clicks a repo row)
async function drillDown(owner: string, repo: string): Promise<void> {
  const result = await app.callServerTool({ name: "get-repo-compliance", arguments: { owner, repo } });
  const detail = JSON.parse(result.content?.find(c => c.type === "text")?.text ?? "{}");
  renderRepoDetail(detail);
}

// Push structured summary back to AI conversation context
app.sendContext?.({ tool: "show-compliance-dashboard", data: { nonCompliantCount: 3 } });
```

### vite.config.ts - Bundle to Single HTML

```typescript
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
export default defineConfig({
  build: { rollupOptions: { input: process.env.INPUT ?? "mcp-app.html" } },
  plugins: [viteSingleFile()],
});
```

### package.json Scripts

```json
{
  "type": "module",
  "scripts": {
    "build": "INPUT=mcp-app.html vite build",
    "serve": "npx tsx server.ts"
  }
}
```

### Test Locally with basic-host

```bash
# 1. Clone the ext-apps test host
git clone https://github.com/modelcontextprotocol/ext-apps.git
cd ext-apps/examples/basic-host && npm install

# 2. In terminal 1: build and start your MCP App server
cd /path/to/your-mcp-app
npm run build && npm run serve

# 3. In terminal 2: start basic-host pointing at your server
SERVERS='["http://localhost:3001/mcp"]' npm start
# Open http://localhost:8080 - select tool, call it, see the UI render
```

## MCP Architecture

```
+--------------------------------+
|   MCP Host (AI Application)    |
|  Claude Desktop / VS Code /    |
|  Custom Chat App               |
|                                |
|  +----------+  +----------+   |
|  | MCP      |  | MCP      |   |
|  | Client 1 |  | Client 2 |   |
|  +----+-----+  +----+-----+   |
+-------|-------------|----------+
        |             |
    stdio/HTTP    stdio/HTTP
   JSON-RPC 2.0  JSON-RPC 2.0
        |             |
+-------+---+   +-----+------+
| MCP Server|   | MCP Server |
| (local)   |   | (remote)   |
| tools     |   | tools      |
| resources |   | resources  |
| prompts   |   | prompts    |
+-----------+   +------------+
```

**Key Participants:**
- **MCP Host**: The AI application (VS Code, Claude Desktop, custom app) that manages MCP clients
- **MCP Client**: One client per server connection; handles JSON-RPC message framing
- **MCP Server**: Your program that exposes tools, resources, and prompts

## Decision Tree

```
What do you need to expose via MCP?
+- Agent should be able to DO something (query, create, update)?
|  -> MCP Tool (tools/call, with JSON Schema input, isError output support)
+- Agent needs READ-ONLY data as context?
|  -> MCP Resource (resources/read, typed URI scheme, MIME type)
+- Reusable prompt template for structured interactions?
|  -> MCP Prompt (prompts/get, named parameters)
|
What transport does your server need?
+- Running locally on same machine as agent (CLI tool, VS Code extension)?
|  -> stdio transport (no network, optimal performance)
+- Deployed remotely (shared service, multi-tenant, enterprise)?
|  -> Streamable HTTP transport (POST + optional SSE, OAuth bearer tokens)
|
Single primitive type or multiple?
+- All of the above?
   -> Single McpServer instance with mixed capabilities
```

## TypeScript SDK (v1 Stable - Production Ready)

Use `@modelcontextprotocol/sdk` v1.x for all production implementations (v2 is pre-alpha).

### Installation

```bash
npm install @modelcontextprotocol/sdk zod
```

### Server Skeleton

```typescript
// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "github-compliance",
  version: "1.0.0",
});

// --- Tool: executable action ---
server.tool(
  "check_repo_compliance",
  "Check all compliance rules for a single GitHub repository",
  {
    owner: z.string().describe("GitHub organisation or user name"),
    repo:  z.string().describe("Repository name"),
  },
  async ({ owner, repo }) => {
    try {
      const result = await checkCompliance(owner, repo);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
      };
    }
  }
);

// --- Resource: read-only context data ---
server.resource(
  "compliance-summary",
  "compliance://org/{org}/summary",
  async (uri) => {
    const org = uri.pathname.split("/")[1];
    const summary = await getOrgSummary(org);
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(summary),
      }],
    };
  }
);

// --- Prompt: reusable interaction template ---
server.prompt(
  "compliance-triage",
  "Generate a triage plan for non-compliant repositories",
  { org: z.string() },
  async ({ org }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `List all non-compliant repos in org "${org}" and suggest remediation steps grouped by rule category.`,
      },
    }],
  })
);

// Connect to transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Transport Selection

### stdio (Local)

```typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const transport = new StdioServerTransport();
await server.connect(transport);
// CRITICAL: never write to stdout - use stderr for logging
console.error("Server started"); // correct
```

- Used by VS Code `.vscode/mcp.json` `"type": "stdio"` entries
- Client launches the server as a child process; communication via stdin/stdout
- Never `console.log()` - it corrupts the JSON-RPC stream; always use `console.error()`

### Streamable HTTP (Remote)

```typescript
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

const app = express();
app.use(express.json());

app.all("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3000, () => console.error("MCP server listening on :3000"));
```

- Exposes an HTTP endpoint; clients POST tool calls, optionally open SSE stream for notifications
- Supports OAuth bearer token authentication in HTTP headers

## VS Code Integration

Register your MCP server in `.vscode/mcp.json` (workspace-scoped):

```json
{
  "servers": {
    "github-compliance": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/dist/server.js"],
      "env": {
        "GITHUB_TOKEN": "${input:githubToken}",
        "GITHUB_ORG":   "${input:githubOrg}"
      }
    }
  },
  "inputs": [
    {
      "id": "githubToken",
      "type": "promptString",
      "description": "GitHub Personal Access Token (read:org, repo)",
      "password": true
    },
    {
      "id": "githubOrg",
      "type": "promptString",
      "description": "GitHub Organisation slug"
    }
  ]
}
```

## Real-Time Notifications

Servers can push `tools/list_changed` notifications when capabilities change dynamically.

```typescript
server.setCapabilities({ tools: { listChanged: true } });

// Trigger when tool set changes at runtime
server.sendToolListChanged();
```

Clients that declared support during init will re-fetch `tools/list` automatically.

## Tool Design Patterns

### Compliance Check Tool (GitHub Enterprise Pattern)

```typescript
server.tool(
  "get_org_compliance_summary",
  "Aggregate compliance status across all repos in a GitHub Enterprise org",
  {
    org:            z.string().describe("GitHub Enterprise organisation slug"),
    include_archived: z.boolean().default(false),
    team:           z.string().optional().describe("Filter to repos owned by team slug"),
  },
  async ({ org, include_archived, team }) => {
    const repos = await listOrgRepos(org, { include_archived, team });
    const results = await Promise.all(repos.map(r => checkCompliance(r.owner, r.name)));
    const summary = buildComplianceSummary(results);
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  }
);
```

### Pagination Pattern (Large Result Sets)

```typescript
server.tool(
  "list_non_compliant_repos",
  "List repositories not meeting compliance rules, with pagination",
  {
    org:    z.string(),
    cursor: z.string().optional().describe("Page cursor from previous response"),
    limit:  z.number().int().min(1).max(100).default(25),
  },
  async ({ org, cursor, limit }) => {
    const { items, nextCursor } = await getNonCompliantRepos(org, cursor, limit);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ items, nextCursor, hasMore: !!nextCursor }, null, 2),
      }],
    };
  }
);
```

## Resource URI Schemes

```typescript
// Parameterised resource template
server.resource(
  "repo-compliance",
  new ResourceTemplate("compliance://repo/{owner}/{repo}", { list: undefined }),
  async (uri, { owner, repo }) => ({
    contents: [{
      uri:      uri.href,
      mimeType: "application/json",
      text:     JSON.stringify(await checkCompliance(owner, repo)),
    }],
  })
);
```

Standard URI schemes for enterprise compliance MCP servers:
- `compliance://org/{org}/summary` - org-level summary
- `compliance://org/{org}/trend` - compliance trend time series
- `compliance://repo/{owner}/{repo}` - per-repo compliance detail
- `compliance://team/{org}/{team}` - team-scoped aggregate

## Error Handling

Always return `isError: true` with a descriptive message - never throw unhandled exceptions.

```typescript
async ({ owner, repo }) => {
  try {
    const data = await fetchRepoData(owner, repo);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Classify error type for the calling agent
    const code = (err as NodeJS.ErrnoException).code;
    const text = code === "RATE_LIMITED"
      ? `GitHub API rate limited. Retry after ${(err as any).retryAfter}s.`
      : `Failed to fetch ${owner}/${repo}: ${msg}`;
    return { isError: true, content: [{ type: "text", text }] };
  }
}
```

## Project Structure

```
mcp-{app-name}/
+-- src/
|   +-- server.ts          # McpServer init + transport
|   +-- tools/             # One file per tool group
|   |   +-- compliance.ts  # check_repo_compliance, get_org_summary
|   |   +-- repos.ts       # list_org_repos, get_repo_details
|   +-- resources/         # Resource handlers
|   |   +-- summary.ts     # compliance://org/{org}/summary
|   +-- prompts/           # Prompt templates
|   |   +-- triage.ts      # compliance-triage
|   +-- lib/               # Shared utilities
|       +-- github.ts      # GitHub API client wrapper
|       +-- scoring.ts     # Compliance score calculation
+-- dashboard/             # Optional: frontend dashboard
|   +-- src/
|   +-- package.json
+-- package.json
+-- tsconfig.json
+-- .vscode/
|   +-- mcp.json           # Local server registration
+-- dist/                  # Compiled output (gitignored)
+-- docs/
    +-- mcp-app/           # MCP app documentation
        +-- TOOLS.md       # Tool catalogue
        +-- RESOURCES.md   # Resource catalogue
```

## Testing with MCP Inspector

MCP Inspector provides a browser-based UI for testing servers interactively.

```bash
# Build first
npm run build

# Launch inspector (stdio server)
npx @modelcontextprotocol/inspector node dist/server.js

# Launch inspector (HTTP server - connect to running instance)
npx @modelcontextprotocol/inspector --url http://localhost:3000/mcp
```

Inspector features:
- Browse all registered tools, resources, prompts
- Call tools with a JSON form and see raw responses
- View JSON-RPC message trace for debugging

## Python SDK (FastMCP Pattern)

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("github-compliance")

@mcp.tool()
async def check_repo_compliance(owner: str, repo: str) -> dict:
    """Check all compliance rules for a GitHub repository.

    Args:
        owner: GitHub org or user name
        repo: Repository name
    """
    return await _check_compliance(owner, repo)

@mcp.resource("compliance://org/{org}/summary")
async def get_org_summary(org: str) -> str:
    """Get compliance summary for all repos in an org."""
    import json
    summary = await _build_summary(org)
    return json.dumps(summary)

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

## Core Rules

1. MUST use `registerAppTool` (not `server.tool`) for the primary tool that triggers the UI render
2. MUST include `_meta.ui.resourceUri` with `ui://` scheme in the app tool registration
3. MUST use `StreamableHTTPServerTransport` on Express - MCP Apps cannot use stdio transport
4. MUST call `app.connect()` exactly once at UI initialisation before any `ontoolresult` or `callServerTool` usage
5. MUST run `npm run build` before `npm run serve` - the server reads `dist/mcp-app.html`
6. MUST handle latency in `callServerTool` calls - each is an async HTTP round-trip
7. MUST bundle all UI assets into the HTML via vite-plugin-singlefile OR declare external origins in `_meta.ui.csp`
8. MUST NOT access parent window DOM, cookies, or localStorage from the iframe
9. SHOULD use `app.sendContext()` to push structured data back to the AI conversation after user interaction
10. SHOULD register drill-down detail tools as regular `server.tool()` (no `_meta.ui.resourceUri` needed)

## Anti-Patterns

| Do Not | Do Instead |
|--------|------------|
| Use `server.tool()` for the primary UI-triggering tool | Use `registerAppTool()` with `_meta.ui.resourceUri` |
| Use stdio transport for MCP Apps | Use `StreamableHTTPServerTransport` on Express port |
| Load external scripts without declaring CSP | Bundle with vite-plugin-singlefile or add origins to `_meta.ui.csp` |
| Call `callServerTool()` before `app.connect()` | Always `app.connect()` first on UI init |
| Fetch GitHub API directly from UI code | Route all data fetching through MCP server tools |
| Use `innerHTML` with user-supplied values | Use `textContent` or DOM `createElement` APIs |
| Serve before building (`npm run serve` only) | Always `npm run build && npm run serve` |

## Reference Index

| Document | Description |
|----------|-------------|
| [references/ext-apps-api.md](references/ext-apps-api.md) | Full `App` class API: connect, ontoolresult, callServerTool, sendContext, logging, openUrl |
| [references/multi-tool-patterns.md](references/multi-tool-patterns.md) | Drill-down tool patterns, context update flows, streaming result patterns |
| [references/framework-examples.md](references/framework-examples.md) | React, Vue, Svelte starter patterns for `src/mcp-app.ts` with typed state management |

## Asset Templates

| File | Description |
|------|-------------|
| [assets/server-template.ts](assets/server-template.ts) | Full `server.ts`: McpServer, registerAppTool, registerAppResource, Express, drill-down tool |
| [assets/ui-template.ts](assets/ui-template.ts) | Full `src/mcp-app.ts`: App class, ontoolresult, callServerTool, sendContext |
| [assets/vite-config.ts](assets/vite-config.ts) | `vite.config.ts` with vite-plugin-singlefile and INPUT env var |
| [assets/package-json.json](assets/package-json.json) | `package.json` with all required deps and build/serve/dev scripts |
````
