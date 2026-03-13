---
title: Repo Structure Alignment
status: In Progress
owner: Engineer
last_updated: 2026-03-12
---

# Execution Plan: Repo Structure Alignment

## Purpose / Big Picture

Reduce repository sprawl by introducing a clearer documentation structure for both living execution state and durable workflow artifacts. The goal is to establish explicit canonical locations, document the structure clearly, and keep legacy paths readable long enough for dependent contracts to converge.

## Progress

- [x] Structural review completed
- [x] Migration risk assessed
- [x] First-slice scope narrowed to execution artifacts
- [x] Execution artifact folders created
- [x] Canonical references fully rewired
- [x] Validation recorded
- [x] Durable artifact families moved under `docs/artifacts/`
- [x] Legacy artifact-family shims added
- [x] Repo contracts rewired to canonical artifact paths

## Surprises & Discoveries

- Observation: The path families for PRDs, ADRs, specs, and reviews are referenced broadly across agent contracts, prompts, schemas, memories, and historical docs.
  Evidence: Repo-wide searches show many references to `docs/artifacts/prd/`, `docs/artifacts/adr/`, `docs/artifacts/specs/`, and `docs/artifacts/reviews/` in `.github/agents/`, `.claude/commands/`, `.github/prompts/`, `.github/schemas/`, and `docs/`.
- Observation: The biggest immediate structural win is the execution artifact family because it had duplicate filenames in adjacent folders.
  Evidence: Both `docs/plans/` and `docs/progress/` held `HARNESS-IMPLEMENTATION.md` and `PLATFORM-PARITY-IMPLEMENTATION.md`.
- Observation: The extension and CLI both embed documentation-path assumptions, so artifact migration is not purely editorial.
  Evidence: Runtime references existed in `vscode-extension/src/utils/learnings.ts`, `vscode-extension/src/review/review-findings.ts`, `.agentx/agentx-cli.ps1`, and `.github/workflows/agent-x.yml`.

## Decision Log

- Decision: Standardize living execution artifacts under `docs/execution/plans/` and `docs/execution/progress/` before touching the durable artifact families.
  Options Considered: Full repo move in one pass; execution-only cleanup first; doc-only plan with no file changes.
  Chosen: Execution-only cleanup first.
  Rationale: It fixes real structure problems now without forcing a risky cross-cutting migration across agent contracts and historical references.
  Date/Author: 2026-03-12 / GitHub Copilot
- Decision: Consolidate durable artifact families under `docs/artifacts/` once the dependent contracts were enumerated.
  Options Considered: Leave the artifact families split at the top level; move only PRD/ADR/spec; move all durable families together under one canonical root.
  Chosen: Move all durable artifact families together under `docs/artifacts/`.
  Rationale: A single durable-artifact root makes the docs topology legible and keeps execution-state docs separate from long-lived deliverables.
  Date/Author: 2026-03-12 / GitHub Copilot

## Context and Orientation

Key files:

- `docs/WORKFLOW.md`
- `docs/GOLDEN_PRINCIPLES.md`
- `docs/README.md`
- `docs/artifacts/`
- `docs/execution/`
- `docs/plans/`
- `docs/progress/`

Constraints:

- Keep ASCII-only formatting.
- Preserve working references during migration.
- Keep legacy top-level artifact directories readable as redirect-only shims during the migration window.

## Plan of Work

Create the canonical `docs/execution/` tree, move the existing plan/progress artifacts into distinct plan/progress filenames, consolidate durable artifact families under `docs/artifacts/`, add redirect shims for old paths, update workflow guidance plus runtime contracts, and validate internal references.

## Concrete Steps

- Move the four active plan/progress artifacts into `docs/execution/`.
- Move `prd/`, `adr/`, `specs/`, `reviews/`, and `learnings/` into `docs/artifacts/`.
- Add redirect stubs at the old paths.
- Add a docs index that explains the canonical layout.
- Update workflow, principle, agent, prompt, workflow, CLI, and extension docs to point to the canonical locations.
- Run markdown reference validation.

## Validation and Acceptance

- [x] Canonical execution folders exist
- [x] Existing plan/progress artifacts moved into canonical locations
- [x] Legacy plan/progress paths preserved as redirects
- [x] Canonical docs reference the new locations
- [x] Durable artifact families moved into `docs/artifacts/`
- [x] Legacy artifact-family paths preserved as redirects
- [x] Runtime and workflow contracts updated to canonical artifact paths
- [x] Reference validation executed without introducing new high-severity failures

## Idempotence and Recovery

This slice is safe to rerun because the canonical folders can be recreated and the redirect files are additive. If validation exposes drift, the old redirect files keep the legacy paths readable while references are repaired.

## Artifacts and Notes

- [PASS] `scripts/validate-references.ps1` ran on 2026-03-12 after the execution-doc restructure.
- [INFO] The validator reported 234 existing `[LOW]` broken-link findings elsewhere in the repo, but no new `[HIGH]` failures were introduced by this slice.
- [PASS] `get_errors` reported no errors in the updated workflow, principles, docs index, execution README, or the new structure plan/progress files.

## Outcomes & Retrospective

The first two structure-alignment slices landed cleanly. The repo now has a documented canonical location for living execution artifacts, durable workflow artifacts live under a single `docs/artifacts/` root, and the legacy top-level directories remain readable during migration. A later phase can focus on code-layout cleanup inside the extension and other runtime surfaces without reopening the documentation topology question.

---

**Template**: [EXEC-PLAN-TEMPLATE.md](../../../.github/templates/EXEC-PLAN-TEMPLATE.md)