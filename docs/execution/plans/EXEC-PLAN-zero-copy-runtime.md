---
description: 'Execution plan for zero-copy installed runtime architecture in the VS Code extension and CLI.'
---

# Execution Plan: Zero-Copy Installed Runtime

**Issue**: N/A
**Author**: AgentX Auto
**Date**: 2026-03-18
**Status**: Complete

---

## Purpose / Big Picture

Move AgentX from copied workspace runtime assets to an installed-runtime model. New workspaces should contain only mutable state and artifacts, while default agents, templates, guides, and runtime scripts are executed from the installed extension bundle unless the workspace explicitly overrides them.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] Implementation started
- [x] Acceptance evidence recorded

## Surprises & Discoveries

- Observation: The bundled extension runtime already carried nearly all required assets, so the main gap was runtime path ownership rather than missing capability.
	Evidence: `vscode-extension/.github/agentx/` contained bundled agents/templates/docs and runtime wrappers.
- Observation: `copy-assets.js` was missing `agentic-runner.ps1`, which would have broken installed-runtime execution.
	Evidence: runtime file list in `vscode-extension/scripts/copy-assets.js` omitted that file before this change.

## Decision Log

- Decision: New Initialize flow is state-only and no longer downloads or copies runtime/default assets.
	Options Considered: keep hidden `.agentx/runtime`; keep visible workspace copies; use installed bundle plus workspace overrides.
	Chosen: installed bundle plus workspace overrides.
	Rationale: copied defaults go stale after AgentX updates and defeat the no-clutter goal.
	Date/Author: 2026-03-18 / AgentX Auto
- Decision: CLI execution should run from the bundled extension runtime while receiving `AGENTX_WORKSPACE_ROOT` as explicit context.
	Options Considered: continue deriving root from script location; copy scripts into workspace; inject workspace root.
	Chosen: inject workspace root.
	Rationale: installed runtime must not confuse install location with workspace ownership.
	Date/Author: 2026-03-18 / AgentX Auto

## Context and Orientation

Key files:
- `vscode-extension/src/commands/initializeInternals.ts`
- `vscode-extension/src/commands/initializeCommandInternals.ts`
- `vscode-extension/src/agentxContext.ts`
- `vscode-extension/src/agentxContextInternals.ts`
- `vscode-extension/src/utils/shell.ts`
- `.agentx/agentx-cli.ps1`
- `.agentx/agentic-runner.ps1`
- `vscode-extension/scripts/copy-assets.js`

## Pre-Conditions

- [x] Issue exists and is classified
- [x] Dependencies checked (no open blockers)
- [x] Required skills identified
- [x] Complexity assessed and this task is confirmed to require a plan

## Plan of Work

Convert Initialize into a workspace-state bootstrap only, then switch extension CLI invocation to the bundled runtime and pass the active workspace root via environment. Update the PowerShell runtime to honor the injected workspace root while resolving default agent definitions from installed assets. Finally, refresh bundling, adjust tests, and validate with compile, targeted tests, and a bundled-runtime smoke test.

## Steps

| # | Step | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Remove archive/copy behavior from Initialize | AgentX Auto | Complete | New workspaces keep only mutable state/artifact folders |
| 2 | Switch extension CLI path to bundled runtime | AgentX Auto | Complete | Uses `extensionPath/.github/agentx/.agentx` |
| 3 | Inject workspace root into shell execution | AgentX Auto | Complete | `AGENTX_WORKSPACE_ROOT` |
| 4 | Update PowerShell runtime root and agent resolution | AgentX Auto | Complete | Installed assets now act as default fallback |
| 5 | Refresh bundle, tests, and validation evidence | AgentX Auto | Complete | Compile, focused tests, and smoke test recorded |

## Concrete Steps

- `node vscode-extension/scripts/copy-assets.js`
- `npx tsc -p ./`
- `npx mocha "out/test/agentxContext.test.js" "out/test/commands/initialize.test.js"`
- `pwsh -File .\vscode-extension\.github\agentx\.agentx\agentx.ps1 workflow engineer`

## Blockers

| Blocker | Impact | Resolution | Status |
|---------|--------|------------|--------|
| Stale patch context during first multi-file edit | Slowed implementation | Re-read live file regions and patch in smaller slices | Resolved |

## Validation and Acceptance

- [x] Initialize no longer copies runtime/default assets into the workspace
- [x] Extension resolves CLI execution through bundled runtime assets
- [x] Bundled runtime can execute against the current workspace via injected root

## Idempotence and Recovery

Re-running Initialize is safe because it only creates mutable directories and rewrites local config/version/state files. Bundled runtime fallback preserves compatibility for older workspaces that still have `.agentx/runtime` copies.

## Rollback Plan

Restore the previous initialize manifest and command internals, revert bundled-runtime CLI path selection in the extension, and remove installed-asset fallback from the PowerShell runtime.

## Artifacts and Notes

- Focused compile: clean after test fix.
- Focused Mocha rerun: edited initialize/context tests pass; four unrelated pre-existing extension test failures remain in setup/chat/loop areas.
- Smoke test: bundled `agentx.ps1 workflow engineer` succeeded when `AGENTX_WORKSPACE_ROOT` pointed at the repo workspace.

## Outcomes & Retrospective

The zero-copy architecture is now implemented for new extension-based initialization. Workspace ownership is limited to mutable state and artifact families, while installed assets provide the default runtime behavior and remain updateable with the extension.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)