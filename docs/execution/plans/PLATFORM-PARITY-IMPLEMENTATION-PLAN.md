---
title: Platform Parity Implementation
status: In Progress
owner: Engineer
last_updated: 2026-03-08
---

# Execution Plan: Platform Parity Implementation

## Purpose / Big Picture

Implement the provider-based parity slice that makes Local, GitHub, and ADO integrations behave consistently at the CLI and validation-host layers, starting by fixing provider resolution and adding a shared validation path for GitHub Actions, Azure Pipelines, and local execution.

This execution plan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work proceeds.

## Progress

- [x] Initial plan drafted
- [x] Repo context and dependencies reviewed
- [x] Validation approach defined
- [x] Implementation started
- [x] Acceptance evidence recorded

## Surprises & Discoveries

- Observation: The CLI still resolves platform behavior from `config.mode`, but the extension initializer writes `integration` metadata instead.
  Evidence: `.agentx/agentx-cli.ps1` returns `(Get-AgentXConfig).mode ?? 'local'`, while `vscode-extension/src/commands/initialize.ts` writes `integration: 'github'` or `integration: 'ado'`.
- Observation: ADO is visible in the extension UI and setup flow, but Azure CLI is not present in the current environment.
  Evidence: `az --version` failed on 2026-03-08 with command-not-found, while `gh --version` succeeded.

## Decision Log

- Decision: Normalize provider selection through a canonical `provider` field with backward-compatible fallback to `integration` and `mode`.
  Options Considered: Keep `mode`; switch everything to `integration`; introduce `provider` with fallback support.
  Chosen: Introduce `provider` with fallback support.
  Rationale: It fixes current breakage without forcing an immediate migration of older configs or docs.
  Date/Author: 2026-03-08 / GitHub Copilot
- Decision: Add Azure Pipelines parity through shared harness validation and dependency gating before attempting broad ADO work-item mutations.
  Options Considered: Keep ADO config-only; implement full ADO issue CRUD immediately; deliver validation-host parity first.
  Chosen: Deliver validation-host parity first.
  Rationale: The repo already has a reusable harness validator, and the current environment lacks Azure CLI for safe end-to-end ADO work-item command validation.
  Date/Author: 2026-03-08 / GitHub Copilot
- Decision: Keep GitHub Project V2 status sync in the CLI when a project number is explicitly configured.
  Options Considered: Leave Project updates to MCP only; require manual status management; add bounded CLI support for the Status single-select field.
  Chosen: Add bounded CLI support for the Status field only.
  Rationale: It keeps issue lifecycle and project status transitions aligned without broadening CLI scope into full project management.
  Date/Author: 2026-03-08 / GitHub Copilot

## Context and Orientation

Key implementation files:

- `.agentx/agentx-cli.ps1`
- `vscode-extension/src/commands/initialize.ts`
- `vscode-extension/src/commands/setupWizard.ts`
- `vscode-extension/src/utils/dependencyChecker.ts`
- `scripts/check-harness-compliance.ps1`
- `azure-pipelines.yml`

Constraints:

- Keep the GitHub path working while fixing the config mismatch.
- Preserve local mode as the zero-setup default.
- Make ADO explicit and capability-gated instead of silently degrading into local behavior.

## Pre-Conditions

- [x] Issue exists and is classified
- [x] Dependencies checked (no open blockers)
- [x] Required skills identified
- [x] Complexity assessed and this task is confirmed to require a plan

## Plan of Work

Fix the provider-selection bug in the CLI, update initialization to write the canonical provider field, add Azure dependency checks, and add an Azure Pipelines entrypoint that invokes the same harness validation script already used in GitHub Actions. Finish with targeted CLI and extension validation.

## Steps

| Step | Action | Owner | Status | Notes |
|------|--------|-------|--------|-------|
| 1 | Create execution plan and progress artifacts for parity implementation | Engineer | Complete | This document and matching progress log |
| 2 | Normalize provider resolution in the CLI and config writing paths | Engineer | Complete | CLI now resolves `provider`, then `integration`, then `mode` |
| 3 | Add dependency awareness for Azure DevOps provider support | Engineer | Complete | Azure CLI and azure-devops extension gating added to extension checks |
| 4 | Add Azure Pipelines validation-host parity | Engineer | Complete | Reuses harness compliance script |
| 5 | Implement provider-aware issue mutation paths and config/documentation parity | Engineer | Complete | GitHub and ADO create/update/comment/close now route through provider-specific handlers; guide and README updated to prefer `provider` |
| 6 | Add GitHub Project V2 status sync for configured GitHub providers | Engineer | Complete | CLI resolves project item IDs and Status option IDs via `gh project` commands |
| 7 | Run targeted validation and capture evidence | Engineer | Complete | Diagnostics clean, harness compliance passed, CLI smoke checks passed |

## Concrete Steps

- Patch `.agentx/agentx-cli.ps1` to resolve provider from `provider`, `integration`, then `mode`.
- Patch `initialize.ts` so new installs write `provider` consistently.
- Patch dependency checks to recognize Azure CLI requirements when ADO integration is configured.
- Add `azure-pipelines.yml` that runs the harness compliance script and extension tests.
- Record validation results in this plan and the progress log.

## Blockers

| Blocker | Impact | Owner | Status |
|---------|--------|-------|--------|
| Azure CLI is not installed in the current environment | Cannot fully execute live ADO commands locally | Engineer | Open |

## Validation and Acceptance

- [x] CLI uses the configured provider even when config was written by the extension initializer
- [x] Local remains the default when no provider metadata exists
- [x] ADO surfaces explicit dependency requirements instead of silently acting like local mode
- [x] Azure Pipelines can run the same harness compliance script used by GitHub Actions
- [x] GitHub and ADO issue create/update/comment/close paths no longer fall back to local issue files
- [x] User-facing docs describe `provider` as the canonical runtime field while preserving legacy compatibility
- [x] Configured GitHub providers can sync Project V2 Status on issue create, update, and close
- [x] Live GitHub Project V2 validation confirmed create -> Backlog -> In progress -> In review -> Done using the AgentX CLI

Evidence: Validation output will be recorded in `Artifacts and Notes` and in `docs/execution/progress/PLATFORM-PARITY-IMPLEMENTATION-PROGRESS.md`.

## Idempotence and Recovery

The provider-resolution change is additive and backward-compatible. Re-running initialization with the same provider should overwrite metadata consistently. If Azure-specific validation fails, GitHub and local behavior should remain unaffected because the provider logic is isolated.

## Rollback Plan

Revert the provider-resolution and initialization changes together if CLI behavior regresses. Remove `azure-pipelines.yml` only if the parity slice is abandoned.

## Artifacts and Notes

- Info: `gh --version` succeeded on 2026-03-08.
- Info: `az --version` failed on 2026-03-08 because Azure CLI is not installed in the current environment.
- Pass: `pwsh -File .\scripts\check-harness-compliance.ps1 -ReportOnly` succeeded on 2026-03-08 after the parity changes.
- Pass: `npm test` succeeded in `vscode-extension/` on 2026-03-08 after updating the dependency-checker expectation for the new Azure CLI probe.
- Pass: CLI smoke checks succeeded on 2026-03-08 for `agentx version`, `agentx issue list --json`, and `agentx issue get -n 46`.
- Pass: CLI smoke checks succeeded on 2026-03-08 for `agentx version` and `agentx issue list --json` after adding provider-aware issue write handlers.
- Pass: `get_errors` reported no PowerShell errors in `.agentx/agentx-cli.ps1` and no Markdown errors in `README.md` after the provider-parity documentation updates.
- Pass: Read-only `gh project list`, `gh project view`, `gh project field-list`, and `gh project item-list` probes succeeded on 2026-03-08 and confirmed the JSON shape used by the new Project V2 status-sync helpers.
- Pass: Live validation on 2026-03-08 using temporary GitHub issue `#128` in project `4` confirmed:
  - create via `agentx issue create` added the issue to the project with Status `Backlog`
  - `agentx issue update -s "In Progress"` changed project status to `In progress`
  - `agentx issue update -s "In Review"` changed project status to `In review`
  - `agentx issue close` closed the GitHub issue and changed project status to `Done`
- Info: `pwsh -File .\tests\test-framework.ps1` still reports pre-existing unrelated failures in legacy expectations such as `clarify` and older AI-first wording checks; the new `azure-pipelines.yml` presence check passed.

## Outcomes & Retrospective

Completed the current provider-parity slice without destabilizing the existing local path. The work now covers provider resolution, provider-aware issue reads and writes, bounded GitHub Project V2 status sync with live validation, shared validation hosting, and documentation parity around canonical config fields. The remaining gap is live ADO validation in an environment that actually has Azure CLI and the azure-devops extension installed.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)