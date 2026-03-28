---
description: 'Progress log for story #249: reset-vs-compaction policy for long-running work.'
---

# Progress Log: Story #249 - Reset Vs Compaction Policy

## Current Status

- Date: 2026-03-28
- State: Complete

## Completed

- Reviewed the current compaction and stale-loop behavior in `.agentx/agentic-runner.ps1` and `.agentx/agentx-cli.ps1`.
- Added `docs/guides/RESET-VS-COMPACTION-POLICY.md` with explicit continue, compact, and reset factors.
- Updated `docs/WORKFLOW.md` so the `Work` checkpoint includes reset-vs-compaction policy guidance grounded in durable artifacts.
- Validated the touched files and references.

## Next

- Begin story `#251` for contract-aware extension operator surfaces.