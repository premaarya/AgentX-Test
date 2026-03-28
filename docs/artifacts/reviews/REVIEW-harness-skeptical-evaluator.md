# Code Review: Skeptical Evaluator, Stall Detection, and Exit Code Fix

**Commits**: `1be6060`, `f679db9`, `fd4b6c9`
**Scope**: 16 files, 661 insertions, 44 deletions
**Date**: 2026-03-28
**Reviewer**: GitHub Copilot (AgentX Reviewer mode)
**Decision**: **APPROVED** with 4 recommended follow-up items

---

## Summary

This batch delivers three related improvements to the AgentX agentic harness:

1. **Exit code fix** (`f679db9`): `agentx.ps1` now propagates the real runner exit code (0/1/2 for text_response/error/human_required). `Invoke-RunCmd` uses a switch on `$result.exitReason` and correctly handles a null result.
2. **Skeptical evaluator and stall detection** (`1be6060`): A new `Invoke-SelfReviewLoop` function runs 8-category per-verdict review with calibration examples. Stall detection injects pivot-vs-refine guidance after 3 consecutive failures. Agent definitions (architect, engineer, reviewer) gain meaningful guardrails: the over-specification table, live-surface verification, and per-category hard thresholds.
3. **Knowledge capture** (`fd4b6c9`): Memory files updated with session learnings from the live CLI validation run.

125/125 tests pass. The certification at `docs/testing/CERT-2026-03-28-live-cli-validation.md` covers all key scenarios including Copilot 403 fallback.

The quality of the agent definition improvements is high. The harness additions are well-structured. Four findings below do not block this work but should be filed as follow-up.

---

## Checklist Results

| Category | Verdict | Notes |
|----------|---------|-------|
| **Spec Conformance** | PASS | No formal spec for runner; changes match stated intent in commit messages and cert doc |
| **Code Quality** | PASS | Clear structure, consistent PowerShell style, `Set-StrictMode -Version Latest` respected |
| **Testing** | PASS | 125/125 passing; new runner behavior tests cover stall, self-review min gate, SkipLoopStateSync; live E2E passes 11/11 |
| **Security** | PASS | No hardcoded secrets; SQL not applicable; `terminal_exec` blocklist noted as advisory (see Finding 3) |
| **Performance** | PASS | No blocking hot-path changes; `Start-Job`-based terminal execution is correctly bounded with timeout |
| **Error Handling** | PASS* | Self-review fail-open on API errors noted as Finding 1; all other error paths are explicit |
| **Documentation** | PASS | Two new guide docs, updated WORKFLOW.md, cert report, calibration examples all well-written |
| **Intent Preservation** | PASS | Agent definition changes sharpen existing intent without distorting the original contracts |

\* Error Handling is PASS overall because the fail-open is isolated to the self-review evaluator sub-path,
not the main loop's error handling. The main loop and Invoke-LlmChat both propagate errors cleanly.

---

## Findings

### Finding 1 -- MEDIUM: Self-review fails open on LLM API error

**Location**: `.agentx/agentic-runner.ps1` line 1986

**Code**:
```powershell
# Invoke-SelfReviewLoop catch block
return @{ approved = $true; findings = @(); feedback = '(Reviewer error -- auto-approving)' }
```

**Description**: When `Invoke-LlmChat` throws inside `Invoke-SelfReviewLoop` (e.g., transient API failure during review), the catch block returns `approved = $true` with a feedback message. This is fail-open behavior: a network blip silently skips the quality gate. The main loop will count this as an approved iteration toward the 5-pass minimum.

**Recommended fix**:
```powershell
# Replace the catch block with fail-closed behavior
return @{ approved = $false; findings = @(); feedback = "(Reviewer error: $($_.Exception.Message)). Quality gate not satisfied." }
```

If the intent is specifically to avoid blocking on transient errors, it should at least not count toward the approved minimum -- add `skipCount = $true` to the returned hash and handle it in `Invoke-AgenticLoop`.

**Confidence**: HIGH

---

### Finding 2 -- MEDIUM: `harness.selfReview.*` config surface documented but not wired

**Location**: `docs/guides/HARNESS-PRUNING-RUBRIC.md` lines 58-75 vs `.agentx/agentic-runner.ps1` lines 2581-2582, 2725

**Description**: The pruning rubric documents a `config.json` surface:
```json
{
  "harness": {
    "selfReview": {
      "minIterations": 5,
      "maxIterations": 15,
      "stallThreshold": 3,
      "enableCategoryVerdicts": true,
      "enableCalibrationExamples": true,
      "enableStallDetection": true
    }
  }
}
```

In the actual runner:
- `$selfReviewMax = $Script:SELF_REVIEW_MAX_ITERATIONS` (constant, not from `$runtimeConfig`)
- `$selfReviewMin = [Math]::Min($Script:SELF_REVIEW_MIN_ITERATIONS, $selfReviewMax)` (same)
- `$stallThreshold = 3` is hardcoded inside the loop body

The pattern for reading from `$runtimeConfig` already exists (`harness.researchFirstMode` is correctly read via `Get-ResearchFirstMode`). This is an incomplete extension of that pattern.

**Impact**: Users cannot prune these components via config.json as the rubric promises. For the current consumers (solo developers), this is low-friction. For teams adopting the harness, it creates a documentation mismatch that erodes trust in the config surface.

**Recommended fix**: Add `Get-SelfReviewConfig` helper (same pattern as `Get-ResearchFirstMode`) and read the six harness.selfReview values from `$runtimeConfig` at the top of `Invoke-AgenticLoop`, falling back to the existing script-scope constants.

**Confidence**: HIGH

---

### Finding 3 -- MEDIUM: `terminal_exec` blocklist is advisory, not documented as such

**Location**: `.agentx/agentic-runner.ps1` line 988

**Code**:
```powershell
$blocked = @('rm -rf /', 'format c:', 'drop database', 'git reset --hard', 'git push --force')
```

**Description**: The 5-entry case-insensitive substring blocklist catches only the most obvious destructive commands. Equivalent alternatives are not blocked:
- `Remove-Item -Recurse -Force` (PowerShell equivalent of rm -rf)
- `git push --force-with-lease` (a force push variant)
- `Invoke-Expression` with an encoded/obfuscated payload
- `del /s /q` (Windows equivalent)

This is expected behavior for a developer-tool that runs within an already-trusted workspace context -- the user has explicitly invoked the runner with full workspace access. The concern is that the code does not document this limitation, which means a future reader may rely on it as a security boundary when it is advisory only.

**Recommended fix**: Add a comment at the blocklist definition:
```powershell
# Advisory blocklist -- catches obvious mistakes only. This is not a security boundary.
# terminal_exec runs with full workspace access; only invoke with trusted prompts.
$blocked = @('rm -rf /', 'format c:', 'drop database', 'git reset --hard', 'git push --force')
```

**Confidence**: HIGH

---

### Finding 4 -- LOW: API fallback switches mode but not model ID

**Location**: `.agentx/agentic-runner.ps1` lines 1165-1168

**Code**:
```powershell
if ($Script:ApiMode -eq 'copilot' -and $statusCode -in @(401, 403)) {
    $Script:ApiMode = 'models'
    return Invoke-LlmChat -token $token -modelId $modelId -messages $messages ...
}
```

**Description**: When Copilot returns 401/403, the code switches to GitHub Models and retries with the same `$modelId`. The Copilot model ID (e.g., `claude-3.7-sonnet`, `gpt-5.1`) may not exist on GitHub Models, causing the retry to fail with a 400/404 rather than a clear auth error. The failure message will reference "GitHub Models API error" without indicating it is a model-ID mismatch, not an auth failure.

Note: infinite recursion is not possible here because the second call has `$Script:ApiMode = 'models'`, which prevents the fallback branch from firing again.

**Recommended fix**: After switching mode, re-resolve the model ID:
```powershell
if ($Script:ApiMode -eq 'copilot' -and $statusCode -in @(401, 403)) {
    $Script:ApiMode = 'models'
    $fallbackModelId = Get-ResolvedModelId -agentModel 'default' -WorkspaceRoot $workspaceRoot
    Write-Host "  [API FALLBACK] Retrying with GitHub Models ($fallbackModelId)."
    return Invoke-LlmChat -token $token -modelId $fallbackModelId -messages $messages ...
}
```

Or add a note to the fallback log message that the model may not be available on GitHub Models.

**Confidence**: MEDIUM (depends on whether the cert run hit this path with a non-GPT model)

---

### Minor / Nit

- **WORKFLOW.md formatting**: The new stall detection section (lines added in diff) ends without a blank line before the existing transition guardrails table row (`| Review -> Compound Capture | ...`). This causes the table row to appear as if it's part of the stall detection section in some Markdown renderers. Add a blank line between the closing paragraph and the table continuation. [Nit]

- **cli-live-e2e.ps1 assertion fragility**: `Assert-True ($run.ExitCode -ne 0)` passes if the live run fails or is blocked. If a future API change causes the smoke prompt to succeed cleanly, this assertion passes incorrectly (it expects non-zero but would get zero). Consider asserting `$run.ExitCode -eq 2` (human_required) instead of any non-zero. [Low]

- **Future model IDs in MODEL_MAP_COPILOT**: `gpt-5.4`, `gpt-5.3-codex`, `gpt-5.2-codex`, `gpt-5.1`, `gpt-5-mini` are aspirational model names not yet in production. When Copilot returns 404 for unknown models, `Test-IsModelAvailabilityError` should catch and fall through; this is tested behavior. No code change required -- just a catalog maintenance item. [Nit]

---

## What Is Working Well

- **`Invoke-SelfReviewLoop` architecture**: The skeptical evaluator with per-category verdicts is well-designed. The calibration examples embedded in the prompt (3 inline examples) anchor the evaluator's PASS/FAIL behavior without overwhelming the prompt. The full reference set in `EVALUATOR-CALIBRATION.md` is cleanly separated.

- **Stall detection**: The consecutive-failure check (`$recentFailures | Where-Object { $_.approved } | Measure-Object).Count -eq 0`) is correct. The pivot-vs-refine guidance prompt is concrete and actionable. Recording stall events in `Add-ExecutionSummaryEvent` makes them observable after the session.

- **`reviewer.agent.md` hard threshold column**: The addition of "Hard Threshold" to the review checklist with the "Per-Category Verdict Rule" paragraph closes a real gap where reviewers could approve despite a failing security or spec category. The escalation rule is unambiguous.

- **`architect.agent.md` over-specification guardrails**: The SHOULD/MUST NOT table is precise and addresses a genuine failure mode where over-specified specs cause review conflicts. The "Why this matters" paragraph is worth keeping.

- **`engineer.agent.md` live-surface verification**: Iteration 3 was previously under-specified about what "Production-Ready" meant in practice. The five surface types (CLI, API, UI, scripts, config) and the fallback documentation requirement are good additions.

- **Exit code propagation (`agentx.ps1` + `Invoke-RunCmd`)**: The minimal 3-line fix in `agentx.ps1` is correct. The `switch` on `exitReason` in `Invoke-RunCmd` is clean and handles the null-result case.

- **125/125 tests passing**: The test suite covers the new code paths well, including the SkipLoopStateSync flag, self-review minimum gate, and stall history tracking.

---

## Recommended Follow-up Issues

| Priority | Description | File |
|----------|-------------|------|
| P2 | Change self-review fail-open to fail-closed (Finding 1) | `agentic-runner.ps1` line 1986 |
| P2 | Wire `harness.selfReview.*` config keys to runtime (Finding 2) | `agentic-runner.ps1` lines 2581, 2725 |
| P3 | Add advisory comment to terminal_exec blocklist (Finding 3) | `agentic-runner.ps1` line 988 |
| P3 | Fix WORKFLOW.md section separator (Minor) | `docs/WORKFLOW.md` |

---

## Decision

**APPROVED**

All 8 review categories pass. No Critical or Major findings. The four findings above are Medium/Low and do not block approval -- they should be tracked as follow-up work. The live certification at `docs/testing/CERT-2026-03-28-live-cli-validation.md` confirms the exit code fix and the Copilot 403 fallback path work correctly in production.
