#!/bin/bash
# AgentX CLI launcher - delegates to agentx-cli.ps1 (PowerShell 7)
# Usage: ./.agentx/agentx.sh ready
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export AGENTX_WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
pwsh "$SCRIPT_DIR/agentx-cli.ps1" "$@"
