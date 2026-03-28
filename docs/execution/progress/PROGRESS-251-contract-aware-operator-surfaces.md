---
description: 'Progress log for story #251: contract-aware workflow guidance in extension operator surfaces.'
---

# Progress Log: Story #251 - Contract-Aware Operator Surfaces

## Current Status

- Date: 2026-03-28
- State: Complete

## Completed

- Reused the shared workflow guidance snapshot in `vscode-extension/src/utils/workflowGuidance.ts` to carry active contract path, status, blockers, next action, and slice finding summary.
- Surfaced those values in the Work sidebar guidance tree via `vscode-extension/src/views/workTreeProviderInternals.ts`.
- Confirmed that chat and command surfaces continue to reuse the same workflow guidance path rather than introducing separate contract inference logic.
- Added sidebar-level regression coverage in `vscode-extension/src/test/views/workTreeProviderInternals.test.ts`.

## Next

- Begin story `#252` for pilot and pruning guidance.