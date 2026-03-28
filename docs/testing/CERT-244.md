# Certification Report: contract-driven harness design adoption

**Issue**: #244  
**Version**: 8.4.13  
**Date**: 2026-03-28  
**Tester**: AgentX Tester  

---

## Test Summary

The release candidate was validated using the repo's strongest executable quality paths for
this product: root framework self-tests, installer/system end-to-end tests, and the VS Code
extension coverage/audit/package gates. The installer suite was hardened during this pass to
correct Windows path-with-spaces and working-directory failures in the test harness itself.

## Test Results

| Suite | Result | Evidence |
|-------|--------|----------|
| Root framework self-tests | PASS | `125/125` assertions passed |
| Installer/system E2E | PASS | `138/138` assertions passed |
| Extension automated tests | PASS | `592 passing` |
| Coverage gate | PASS | Statements `81.41%`, Branches `74.09%`, Functions `84.8%`, Lines `81.41%` |
| Dependency audit (`high`) | PASS | No high-severity findings; 2 low-severity dev-only findings remain |
| VSIX packaging | PASS | `agentx-8.4.13.vsix` packaged successfully |

## E2E Strategy Note

This repo does not ship a browser-app E2E harness for the feature under test. For this
release, the correct end-to-end path is the live installer/system validation suite in
`tests/test-install.ps1`, because it exercises the real product bootstrap and runtime
artifact flow across local mode, GitHub mode, reinstall, cleanup, merge-mode, and no-setup
paths.

## Defects Found During Certification

### Fixed in this certification cycle

1. **Installer harness path splitting on Windows**
 - Symptom: direct-file installer tests failed when the repo path contained spaces.
 - Fix: `tests/test-install.ps1` now launches `pwsh` with `System.Diagnostics.ProcessStartInfo.ArgumentList`.

2. **Installer harness running from the wrong directory**
 - Symptom: installer work executed against the repo root instead of the temp test workspace.
 - Fix: `tests/test-install.ps1` now sets the child process working directory explicitly to the active temp workspace.

### Residual non-blocking findings

1. **Low-severity dev dependency advisories**
 - `mocha -> diff` still reports two low-severity issues.
 - Impact: does not fail the repo's `npm audit --audit-level=high` release gate.

2. **Extension packaging size warning**
 - `vsce package` warns about a large file count.
 - Impact: optimization concern only; packaging succeeded.

## Security Results

- [PASS] No hardcoded secret exposure found in the changed files.
- [PASS] High-severity dependency audit gate passes.
- [PASS] Existing SSRF and command-safety regression suites remain green inside extension coverage.
- [WARN] Two low-severity dev-only dependency advisories remain.

## Accessibility Results

- [PASS] No new custom webview or standalone HTML UI was introduced by this slice.
- [PASS] Extension-facing changes are limited to VS Code tree/sidebar labels, guidance text, and markdown docs.
- [PASS] Manual review found no new accessibility blocker in the added operator-surface guidance.

## Performance Results

- [PASS] No measurable regression surfaced in the automated suites.
- [PASS] Harness state additions remain file-backed and lightweight.
- [WARN] VSIX footprint remains larger than ideal and should be optimized separately.

## Go / No-Go Decision

**Decision**: PASS

The release candidate is certified for closeout. All release-critical validation paths pass
on version `8.4.13`, including the corrected installer/system E2E suite. Remaining concerns
are low severity and non-blocking for this repo's current release policy.

## Follow-Up Recommendations

1. Track extension lint baseline cleanup outside this release.
2. Reduce VSIX size through bundling and/or tighter packaging exclusions.
3. Optionally refresh the dev dependency graph again when a low-risk update path for `mocha` lands.