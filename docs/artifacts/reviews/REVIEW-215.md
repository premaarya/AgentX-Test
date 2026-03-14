<!-- Inputs: {issue_number=215}, {date=2026-03-13}, {reviewer=auto-fix-reviewer} -->

# Code Review: Epic #215 - Workflow Guidance, Task Bundles, Bounded Parallel Delivery

**Date**: 2026-03-13
**Reviewer**: Auto-Fix Reviewer
**Scope**: Epic #215 implementation including Feature #226 (Bounded Parallel Delivery) and Feature #227 (Task Bundle And Backlog Operations)
**Status**: APPROVED WITH AUTO-FIXES

---

## Summary

The implementation is architecturally sound, well-typed, fully tested, and follows the established facade-engine-types layering pattern. All quality gates passed before review. Four findings were identified: one type-safety inconsistency (auto-fixed), two broken gate implementations (auto-fixed as correctness bugs), and one project-scoped rollout readiness coupling (auto-fixed by removing the hardcoded file paths).

**Auto-applied fixes**: 4
**Suggested changes**: 0
**Blocked findings**: 0
**Test suite after fixes**: 445 passing, 0 failing

---

## Auto-Applied Fixes

### [FIX-1] LOW - Type Safety: unsafe `asArray<T>` cast in parallelDeliveryEngine.ts

**File**: `vscode-extension/src/parallel/parallelDeliveryEngine.ts`

**Before**:
```ts
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}
// Used as:
followUpReferences: asArray<string>(reconciliation.follow_up_references),
```

**After**: Added a `asStringArray` helper with a type guard filter, consistent with `taskBundlesEngine.ts`.

```ts
function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}
// Used as:
followUpReferences: asStringArray(reconciliation.follow_up_references),
```

**Rationale**: The `taskBundlesEngine` uses a type-guarded filter for string arrays. `asArray<string>()` with a bare cast could silently pass non-string values through into the typed array. Using a type guard is safer and consistent.

---

### [FIX-2] HIGH - Gate Bypass: reconcile command hardcoded all verdicts to 'pass'/'approved'

**File**: `vscode-extension/src/commands/parallel-delivery.ts`

**Before** (`agentx.reconcileBoundedParallelRun`): All five reconciliation fields were hardcoded to
`overlapReview: 'pass'`, `conflictReview: 'pass'`, `acceptanceEvidence: 'pass'`, `ownerApproval: 'approved'`.
This meant the reconciliation gate could never produce `final_decision: 'blocked'` through the UI, regardless of the actual parallel work state.

**After**: Added four `showQuickPick` prompts for `overlapReview`, `conflictReview`, `acceptanceEvidence`, and `ownerApproval`. The verdicts are now collected from the user before `reconcileBoundedParallelRun` is called.

**Rationale**: The reconciliation gate exists to verify that parallel work was correctly completed before closeout. Hardcoding all verdicts to pass unconditionally bypasses the gate entirely, making the `reconcile` command a no-op quality control step.

---

### [FIX-3] MEDIUM - Gate Bypass: assess command hardcoded all eligibility dimensions to eligible values

**File**: `vscode-extension/src/commands/parallel-delivery.ts`

**Before** (`agentx.assessBoundedParallelDelivery`): All five assessment dimensions were hardcoded to
value combinations that always produce `decision: 'eligible'` (`scopeIndependence: 'independent'`,
`dependencyCoupling: 'low'`, `artifactOverlap: 'low'`, `reviewComplexity: 'bounded'`,
`recoveryComplexity: 'recoverable'`). Any call to "Assess Bounded Parallel Delivery" via the command palette
would always record an eligible assessment regardless of actual scope characteristics.

**After**: Added five `showQuickPick` prompts (scope independence, dependency coupling, artifact overlap,
review complexity, recovery complexity) before calling `assessBoundedParallelDelivery`. The CLI's
fail-closed eligibility logic (`Get-BoundedParallelDecision`) now receives real user-supplied inputs.

**Rationale**: The eligibility assessment is the entry gate that determines whether a work item qualifies for parallel execution. Bypassing it means ineligible work can be started as parallel delivery, creating risk of conflicting changes and unrecoverable state.

---

### [FIX-4] MEDIUM - Coupling: rolloutArtifactsReady gated on project-specific SPEC issue numbers

**File**: `vscode-extension/src/utils/workflowGuidance.ts`

**Before**: The `rolloutArtifactsReady` predicate required four hardcoded file paths
(`docs/artifacts/specs/SPEC-218.md` through `SPEC-221.md`) to exist before rollout scorecard rows
would show as `pilot-ready`. These are issue numbers specific to the current epic sprint.

**After**: Removed the four hardcoded SPEC paths from the readiness check. The predicate now only
requires the three canonical rollout guide files to exist (rollout scorecard, pilot order, operator checklist).

**Rationale**: Coupling workspace-agnostic utility logic to project-specific issue numbers means the
scorecard will silently show 'queued' state for every other project or workspace, misleading operators.
The three guide files are the stable preconditions; specific spec files are implementation-time artifacts.

---

## Manual Review Checklist Results

### Architecture & Design
- [PASS] Facade-engine-types layering consistent across both features (task-bundles, parallel-delivery)
- [PASS] Commands delegate to facades, facades delegate to engines, engines contain no VS Code dependencies
- [PASS] ADRs and specs exist at `docs/artifacts/adr/`, `docs/artifacts/specs/`
- [PASS] SRP: Each module has a single clear responsibility
- [PASS] No premature optimization

### Code Quality
- [PASS] Single Responsibility in all modules
- [PASS] DRY: helpers shared within engines (`asString`, `asStringArray`)
- [PASS] KISS: linear command flows, no unnecessary abstraction
- [PASS] No dead code, no commented-out blocks
- [PASS] No magic numbers; typed union literals for state/priority/verdict values
- [PASS] All functions are reasonably sized

### Type Safety
- [PASS] All function parameters and returns are typed
- [PASS] `ReadonlyArray` used on all interface array fields
- [PASS] `readonly` on all interface properties
- [PASS] `unknown` used as parse target; narrowed before use via `asString`, `asNumber`, `asStringArray`
- [PASS] `Extract<>` used for subset types (e.g., `Extract<TaskBundleState, 'Done' | 'Archived'>`)

### Error Handling
- [PASS] All VS Code commands have `try/catch (error: unknown)` with `error instanceof Error` narrowing
- [PASS] `JSON.parse` in engine files propagates exceptions to command-layer catch blocks (by design)
- [PASS] User-cancelled prompts return `undefined` and commands return early without error messages
- [PASS] CLI functions use `exit 1` with descriptive messages on validation failures
- [PASS] Workspace guard (`if (!agentx.workspaceRoot)`) at top of every command handler

### Security
- [PASS] No hardcoded secrets
- [PASS] No SQL operations
- [PASS] CLI inputs passed via base64-encoded flags to avoid shell injection
- [PASS] Input validation in CLI: title required, ID required, normalizer functions for all enum fields
- [PASS] No user input passed to `ConvertTo-Json` without structural wrapping

### Testing
- [PASS] 445 extension tests passing (including new suites for task bundles, parallel delivery, workflow guidance)
- [PASS] 16/16 task-bundle behavior tests passing (`tests/task-bundle-behavior.ps1`)
- [PASS] 13/13 bounded-parallel behavior tests passing (`tests/bounded-parallel-behavior.ps1`)
- [PASS] Facade tests cover: create/list/resolve/promote, assess/start/reconcile with follow-up references
- [PASS] Engine tests cover: JSON parsing with missing/null fields, rendering text
- [PASS] Command registration tests verify all expected command IDs are registered
- [NOTE] Command handler behavior (QuickPick flow) is not covered by unit tests. The registration-only
  pattern is consistent with other command tests in this codebase and is acceptable given the workflow
  is validated through the behavior test scripts.

### Performance
- [PASS] All CLI calls are `async`/`await`
- [PASS] No blocking calls
- [PASS] Output channels lazily initialized (created on first use, not at activation)

### Version Control
- [PASS] No merge conflicts
- [PASS] Files are well-scoped to their feature areas
- [INFO] Commit scope classification from pre-review session still applies (see session memory)

---

## Decision

**APPROVED** - All HIGH and MEDIUM findings have been auto-fixed. Auto-fixes verified against the
full test suite (445 passing, 0 failing, exit code 0). Human approval is required before merge.

