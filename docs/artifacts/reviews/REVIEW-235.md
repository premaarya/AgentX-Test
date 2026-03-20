---
issue: 235
date: 2026-03-20
reviewer: auto-fix-reviewer
status: approved
---

# REVIEW-235: AI Evaluation Contract and Runner Modules

**Files reviewed**:
- vscode-extension/src/eval/aiEvaluationContract.ts (facade)
- vscode-extension/src/eval/aiEvaluationContractInternals.ts
- vscode-extension/src/eval/aiEvaluationContractTypes.ts
- vscode-extension/src/eval/aiEvaluationRunnerInternals.ts
- vscode-extension/src/commands/aiEvaluationCommandInternals.ts

**Compile**: PASS (tsc --noEmit exit 0)
**Tests**: PASS (544 passing, 0 failing)

---

## 1. Spec Conformance

[PASS] Facade delegates all evaluation logic to aiEvaluationContractInternals.ts in line with the facade-plus-internals convention.
[PASS] evaluateAIEvaluationContractFromRoot correctly reads manifest, baseline, and latest report as three independent phases.
[PASS] createAIEvaluationExecutionPlan gates execution on contractReady (requires valid manifest AND valid baseline).
[PASS] normalizeAIEvaluationOutput derives regression deltas from baseline scores with correct epsilon comparison.
[PASS] persistNormalizedAIEvaluationReport only persists raw output when retainRawOutputs is explicitly true.

## 2. Code Quality

[PASS] Single-responsibility principle upheld across all five files.
[PASS] No duplicated parsing logic; isRecord, readOptionalString, readOptionalNumber are nicely factored.
[PASS] readManifest returns undefined manifest (rather than partial) when any required field is missing -- correct fail-fast behavior.
[PASS] Threshold-metric cross-validation (metric must be declared in manifest.metrics) is a good defensive check.
[PASS] buildBlockers deduplicates by code:message key -- prevents duplicate blockers when contract errors and blocker checks overlap.

[LOW - auto-fixed] aiEvaluationContract.ts was missing three public type re-exports:
  - AIEvaluationMetricStatus
  - AIEvaluationDeltaDirection
  - AIEvaluationRegressionDelta
  These are part of the stable consumer surface. Callers importing from the facade would have had to reach into the types module directly.
  -> Applied: all three added to the re-export block.

[LOW - auto-fixed] renderFailureLines and renderExecutionResultText in aiEvaluationCommandInternals.ts both hardcoded the number 5 as a magic slice limit.
  -> Applied: extracted to MAX_DISPLAYED_FAILURE_SLICES = 5.

## 3. Testing

[PASS] 16 eval/command-specific tests covering: contract loading, missing baseline error, remoteHost validation,
       facade undefined-workspace guard, execution planning, raw output normalization, persistence,
       command registration, scaffold, and status text rendering.
[PASS] Tests use fixture-based injection patterns consistent with the rest of the extension test suite.
[SUGGEST] No test for the renderFailureLines truncation. Now that the constant is named, a test asserting
          that more than 5 slices are capped would be easy to add.
[SUGGEST] No test for readRegressionStatus returning 'unknown' when deltas array is empty.

## 4. Security

[PASS] No hardcoded secrets.
[PASS] No shell injection risk: execution command comes from vscode.window.showInputBox (user-facing, sandbox-scoped)
       and is passed as a complete command string to execShellStreaming -- not concatenated into a larger shell expression.
[PASS] writeFileIfMissing checks existence before writing -- no unintentional overwrites.
[PASS] All file I/O paths constructed with path.join from a workspace root -- no path traversal risk from manifest content.
[INFO] createRunId uses Math.random() for the suffix. Acceptable (run IDs are not security tokens).

## 5. Performance

[PASS] evaluateAIEvaluationContractFromRoot reads at most three files per call. Acceptable for on-demand status checks.
[PASS] buildThresholdMap and buildRawMetricMap use Map for O(1) lookups during normalization.
[SUGGEST] readLatestReportFile stats every JSON file in the report directory to sort by mtime. If the directory
          grows large this could slow down. Consider capping the scan.

## 6. Error Handling

[PASS] All file read errors are caught and converted to typed AIEvaluationIssue entries.
[PASS] executeAIEvaluationRunFromRoot and normalizeAIEvaluationOutput throw Error instances with descriptive
       messages -- caught cleanly in the VS Code command try/catch and rendered to the output channel.
[PASS] parseShellRunnerOutput throws on invalid JSON and on missing aggregateMetrics rather than returning
       a silent partial result.

## 7. Documentation

[PASS] Public function signatures are self-documenting; names match the SPEC-235 terminology.
[SUGGEST] evaluateAIEvaluationContractFromRoot has no JSDoc. A one-line note that the function performs
          synchronous file I/O would help callers understand caching expectations.
[SUGGEST] createShellAIEvaluationRunnerAdapter has no JSDoc. A comment explaining runner: 'any' semantics
          would clarify the catch-all adapter pattern.

## 8. Intent Preservation

[PASS] All business logic (manifest validation, regression scoring, threshold evaluation, report status
       derivation) is preserved after the auto-fixes.
[PASS] Auto-fixes are purely additive (re-exports) and naming (constant extraction) -- no behavior changes.

---

## Auto-Applied Fixes

| File | Change | Safe? |
|------|--------|-------|
| vscode-extension/src/eval/aiEvaluationContract.ts | Added AIEvaluationMetricStatus, AIEvaluationDeltaDirection, AIEvaluationRegressionDelta to re-export block | Yes -- additive |
| vscode-extension/src/commands/aiEvaluationCommandInternals.ts | Extracted MAX_DISPLAYED_FAILURE_SLICES = 5, replaced two inline magic numbers | Yes -- no behavior change |

## Suggested Changes (for Engineer, not blocking)

1. Add a test for failure-slice truncation now that MAX_DISPLAYED_FAILURE_SLICES is named.
2. Add an edge-case test for readRegressionStatus with an empty deltas array -> 'unknown'.
3. Add JSDoc to evaluateAIEvaluationContractFromRoot noting synchronous file I/O.
4. Add JSDoc to createShellAIEvaluationRunnerAdapter explaining runner: 'any' semantics.
5. Consider capping the report directory scan in readLatestReportFile if the directory can grow large.

---

## Decision

APPROVED -- Auto-fixes applied and verified (compile clean, 544 tests passing). No blocking or high/medium findings. Status: In Review -> Validating
