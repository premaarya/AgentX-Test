# Hidden Runtime Asset Plan

## Purpose / Big Picture

- Move agent, template, and guide defaults out of visible workspace paths for initialized runtimes.
- Preserve advanced AgentX features by resolving workspace overrides before hidden runtime defaults and bundled extension assets.

## Progress

- [done] Identify runtime consumers that still hardcode visible workspace asset paths.
- [in-progress] Route extension and CLI lookups through hidden runtime defaults.
- [pending] Re-validate compile and targeted tests after fallback updates.

## Decision Log

- Use `.agentx/runtime` as the hidden default asset location for initialized workspaces.
- Keep visible `.github/*` and `docs/guides/*` files as optional overrides rather than required runtime state.

## Validation And Acceptance

- Initialize seeds hidden runtime defaults.
- Extension lookups resolve `workspace override -> .agentx/runtime -> bundled assets`.
- CLI agent resolution resolves `workspace override -> .agentx/runtime`.