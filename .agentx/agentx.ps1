#!/usr/bin/env pwsh
# AgentX CLI launcher - delegates to agentx-cli.ps1 (PowerShell 7)
# Usage: .\.agentx\agentx.ps1 ready
$global:LASTEXITCODE = 0
& "$PSScriptRoot/agentx-cli.ps1" @args
$succeeded = $?
$exitCode = if (Test-Path variable:LASTEXITCODE) { $LASTEXITCODE } else { 0 }
if ($exitCode -eq 0 -and -not $succeeded) { $exitCode = 1 }
exit $exitCode
