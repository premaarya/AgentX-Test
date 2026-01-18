# AgentX Orchestration System - Testing & Operations Guide

## Current Status (2026-01-18)

### ✅ Working Components

| Component | Status | Notes |
|-----------|--------|-------|
| **Product Manager Workflow** | ✅ Working | Creates PRD + backlog hierarchy |
| **Polling-Based Orchestrator** | ✅ Working | Runs every 5 mins, has error handling |
| **Label System** | ✅ Complete | All orchestration labels created |
| **Issue #33 Test Epic** | ✅ Processed | Full PRD + backlog created |

### ⚠️ Known GitHub Issues

| Issue | Description | Workaround |
|-------|-------------|------------|
| **Workflow Dispatch Caching** | GitHub caches workflow triggers and may not recognize `workflow_dispatch` for hours after creation | Use direct workflow_dispatch via CLI when needed |
| **Issues Event Trigger** | `on: issues:` event may not fire reliably for new workflows | Use polling-based orchestrator (`process-ready-issues.yml`) |

## How to Test Agent Workflows

### 1. Product Manager (Working)

```bash
# Create a test epic
gh issue create --title "[Epic] Test Feature" \
  --body "## Description\nTest feature description" \
  --label "type:epic,priority:p1,status:ready"

# Trigger PM workflow manually
gh workflow run "Run Product Manager Agent" \
  -f issue_number=<ISSUE_ID> \
  -f issue_title="Test Feature" \
  -f issue_body="Test description"
```

### 2. Architect (Pending GitHub Cache Refresh)

Once GitHub recognizes `workflow_dispatch`:
```bash
gh workflow run "architect.yml" \
  -f issue_number=<ISSUE_ID> \
  -f workflow_type=feature \
  -f stage=1
```

Current workaround: Wait for GitHub cache to refresh (can take hours) or trigger via GitHub Actions UI.

### 3. Polling Orchestrator

```bash
# Dry run - see what would be processed
gh workflow run "Process Ready Issues" -f dry_run=true

# Real run - process all ready issues
gh workflow run "Process Ready Issues" -f dry_run=false
```

The orchestrator runs automatically every 5 minutes via cron schedule.

## Label Reference

### Issue Type Labels
| Label | Triggers | Agent |
|-------|----------|-------|
| `type:epic` | PM workflow | Product Manager |
| `type:feature` | Architect workflow | Solution Architect |
| `type:story` | Architect workflow | Solution Architect |
| `type:bug` | Engineer workflow | Engineer |
| `type:spike` | Architect workflow | Solution Architect |
| `needs:ux` | UX Designer first | UX Designer |

### Status Labels
| Label | Meaning |
|-------|---------|
| `status:ready` | No blockers, can start |
| `status:in-progress` | Currently being processed |
| `status:done` | Completed |

### Orchestration Labels
| Label | Purpose |
|-------|---------|
| `orchestration:active` | Workflow currently active |
| `orchestration:complete` | Full workflow finished |
| `orchestration:stage-complete` | Current stage done, ready for next |
| `stage:product-manager` | PM agent active |
| `stage:architect` | Architect agent active |
| `stage:ux-designer` | UX Designer agent active |
| `stage:engineer` | Engineer agent active |
| `stage:reviewer` | Reviewer agent active |

## Workflow Files

| File | Purpose | Status |
|------|---------|--------|
| `run-product-manager.yml` | PRD & backlog creation | ✅ Working |
| `architect.yml` | ADR & Tech Spec creation | ⏳ Pending cache |
| `ux-designer.yml` | UX wireframes & flows | ⏳ Pending cache |
| `engineer.yml` | Implementation | ⏳ Pending cache |
| `reviewer.yml` | Code review | ⏳ Pending cache |
| `process-ready-issues.yml` | Polling orchestrator | ✅ Working |
| `orchestrate.yml` | Event-based orchestrator | ⚠️ Issues trigger unreliable |

## Troubleshooting

### Workflow doesn't trigger

1. **Check workflow list**: `gh workflow list --all`
2. **Check if dispatch is recognized**: Try `gh workflow run <name> --help`
3. **Wait for cache refresh**: Can take up to several hours
4. **Use polling orchestrator**: More reliable than event triggers

### Labels not found

1. Create missing labels:
```bash
gh label create "label-name" --description "Description" --color "color-hex"
```

### Orchestrator fails

1. Check logs: `gh run view <RUN_ID> --log`
2. Look for specific errors in output
3. Error handling will revert label changes on failure

## Next Steps

1. Wait for GitHub to refresh workflow caches
2. Test Architect, UX Designer, Engineer, and Reviewer workflows
3. Verify full end-to-end flow: Epic → PM → Architect → Engineer → Reviewer
4. Consider GitHub App approach for more reliable event handling
