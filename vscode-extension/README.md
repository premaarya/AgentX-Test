# AgentX Workflow Enforcer

A VS Code extension that enforces the issue-first workflow by blocking file modifications until a GitHub Issue is claimed.

## Features

- **Save Interception**: Blocks file saves when no active issue is claimed
- **File Creation Blocking**: Prevents new file creation without an issue
- **Status Bar**: Shows current issue status at a glance
- **Quick Actions**: Create and claim issues directly from VS Code
- **Configurable**: Enable/disable enforcement, set exclude patterns

## Installation

### From VSIX (Local)

1. Build the extension:
   ```bash
   cd vscode-extension
   npm install
   npm run compile
   npx vsce package
   ```

2. Install in VS Code:
   - Open VS Code
   - Press `Ctrl+Shift+P` → "Extensions: Install from VSIX..."
   - Select the generated `.vsix` file

### From Marketplace (Coming Soon)

```bash
code --install-extension agentx.agentx-workflow-enforcer
```

## Prerequisites

- **GitHub CLI** (`gh`) must be installed and authenticated
  ```bash
  # Install
  winget install GitHub.cli   # Windows
  brew install gh             # macOS
  
  # Authenticate
  gh auth login
  ```

## Usage

### Status Bar

The extension shows a status indicator in the bottom-left:

| Status | Meaning |
|--------|---------|
| `$(check) AgentX: #123` | Issue #123 is active - you can edit files |
| `$(alert) AgentX: No Issue` | No issue claimed - file saves will be blocked |
| `$(debug-pause) AgentX: OFF` | Enforcement is disabled |

### Commands

| Command | Description |
|---------|-------------|
| `AgentX: Create GitHub Issue` | Create a new issue with title and description |
| `AgentX: Claim GitHub Issue` | Pick from ready issues to claim |
| `AgentX: Check Workflow Status` | Show current issue status |
| `AgentX: Toggle Workflow Enforcement` | Enable/disable blocking |

### Workflow

1. **Start a task**: Create or claim a GitHub Issue
2. **Edit files**: Extension allows saves while issue is active
3. **Complete task**: Close the issue via `gh issue close <ID>`
4. **Status updates**: Extension auto-refreshes every 2 minutes

## Configuration

In VS Code settings (`Ctrl+,`):

| Setting | Default | Description |
|---------|---------|-------------|
| `agentx.enabled` | `true` | Enable workflow enforcement |
| `agentx.blockOnSave` | `true` | Block file saves (vs warning only) |
| `agentx.showWarningOnly` | `false` | Show warning instead of blocking |
| `agentx.excludePatterns` | `[".git/**", "node_modules/**"]` | Files to exclude |
| `agentx.requiredLabels` | `["status:in-progress"]` | Labels indicating claimed issue |

### Example settings.json

```json
{
  "agentx.enabled": true,
  "agentx.blockOnSave": true,
  "agentx.excludePatterns": [
    "**/.git/**",
    "**/node_modules/**",
    "**/*.log",
    "**/*.lock",
    "**/dist/**"
  ]
}
```

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    Extension Flow                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   User attempts to save file                                     │
│              │                                                   │
│              ▼                                                   │
│   ┌─────────────────────┐                                       │
│   │  onWillSaveDocument │  Intercept save event                 │
│   └──────────┬──────────┘                                       │
│              │                                                   │
│              ▼                                                   │
│   ┌─────────────────────┐                                       │
│   │  Check exclude list │  Skip if file is excluded             │
│   └──────────┬──────────┘                                       │
│              │                                                   │
│              ▼                                                   │
│   ┌─────────────────────┐                                       │
│   │  Check active issue │  Query: gh issue list                 │
│   │  via GitHub CLI     │  --label status:in-progress           │
│   └──────────┬──────────┘                                       │
│              │                                                   │
│       ┌──────┴──────┐                                           │
│       │             │                                            │
│       ▼             ▼                                            │
│   ┌───────┐    ┌────────┐                                       │
│   │ Found │    │  None  │                                       │
│   └───┬───┘    └────┬───┘                                       │
│       │             │                                            │
│       ▼             ▼                                            │
│   ✅ Allow      ❌ Show blocking dialog:                         │
│   save          [Create Issue] [Claim Issue] [Skip Once]        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Package
npx vsce package
```

## License

MIT - See [LICENSE](../LICENSE)

## Related

- [AgentX Framework](https://github.com/jnPiyush/AgentX)
- [AGENTS.md](../AGENTS.md) - Agent behavior guidelines
- [GitHub Action](../.github/workflows/enforce-issue-workflow.yml) - Server-side enforcement
