# AI Agent Guidelines

> **Single source of truth for agent behavior and workflows.**

---

## Critical Workflow

### Before ANY Work

1. **Research** codebase (`semantic_search`, `grep_search`, `file_search`)
2. **Classify** request (Epic/Feature/Story/Bug/Spike/Docs)
3. **Create Issue** with type label
4. **Execute** role-specific work
5. **Update Status** in GitHub Projects V2

### Issue Commands

```bash
# Create issue (auto-added to Project board)
gh issue create --title "[Type] Description" --label "type:story"

# Update status via GitHub Projects (NOT labels!)
# Backlog → In Progress → In Review → Ready → Done

# Close issue
gh issue close <ID>
```

> ⚠️ **Status Tracking**: Use GitHub Projects V2 **Status** field, NOT labels.

---

## Classification

| Type | Role | Deliverable |
|------|------|-------------|
| `type:epic` | PM | PRD + Backlog |
| `type:feature` | Architect | ADR + Tech Spec |
| `type:story` | Engineer | Code + Tests |
| `type:bug` | Engineer | Bug fix + Tests |
| `type:spike` | Architect | Research doc |
| `type:docs` | Engineer | Documentation |

**Decision Tree:**
- Broken? → `type:bug`
- Research? → `type:spike`
- Docs only? → `type:docs`
- Large/vague? → `type:epic`
- Single capability? → `type:feature`
- Else → `type:story`

---

## Agent Roles

### Product Manager
- **Trigger**: `type:epic`
- **Output**: PRD at `docs/prd/PRD-{issue}.md`
- **Status**: Move to `Ready` when PRD complete

### Solution Architect
- **Trigger**: `type:feature`, `type:spike`, Status = `Ready` or PRD complete
- **Output**: ADR at `docs/adr/ADR-{issue}.md`, Spec at `docs/specs/`
- **Status**: Move to `Ready` when spec complete

### UX Designer
- **Trigger**: `needs:ux` label
- **Output**: Design at `docs/ux/UX-{issue}.md`
- **Status**: Move to `Ready` when designs complete

### Software Engineer
- **Trigger**: `type:story`, `type:bug`, or spec complete
- **Status**: Move to `In Progress` when starting
- **Output**: Code + Tests (≥80% coverage)
- **Status**: Move to `In Review` when code complete

### Code Reviewer
- **Trigger**: Status = `In Review`
- **Output**: Review at `docs/reviews/REVIEW-{issue}.md`
- **Status**: Move to `Done` and close issue

---

## Handoff Flow

```
PM → UX → Architect → Engineer → Reviewer → Done
     ↑         ↑
   (optional) (optional for small tasks)
```

| Phase | Status Transition | Meaning |
|-------|-------------------|---------|
| PM completes PRD | → `Ready` | Ready for design/architecture |
| UX completes designs | → `Ready` | Ready for architecture |
| Architect completes spec | → `Ready` | Ready for implementation |
| Engineer starts work | → `In Progress` | Active development |
| Engineer completes code | → `In Review` | Ready for code review |
| Reviewer approves | → `Done` + Close | Work complete |

### Status Values

| Status | Meaning |
|--------|--------|
| `Backlog` | Issue created, not started |
| `In Progress` | Active work by Engineer |
| `In Review` | Code review phase |
| `Ready` | Design/spec done, awaiting next phase |
| `Done` | Completed and closed |

---

## Templates

| Template | Location |
|----------|----------|
| PRD | `.github/templates/PRD-TEMPLATE.md` |
| ADR | `.github/templates/ADR-TEMPLATE.md` |
| Spec | `.github/templates/SPEC-TEMPLATE.md` |
| UX | `.github/templates/UX-TEMPLATE.md` |
| Review | `.github/templates/REVIEW-TEMPLATE.md` |

---

## Commit Messages

```
type: description (#issue-number)
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

---

## Security

**Blocked Commands**: `rm -rf /`, `git reset --hard`, `drop database`

**Checklist**:
- ✅ No hardcoded secrets
- ✅ SQL parameterization
- ✅ Input validation
- ✅ Dependencies scanned

---

## Quick Reference

### File Locations

| Need | Location |
|------|----------|
| Agent Definitions | `.github/agents/` |
| Templates | `.github/templates/` |
| Skills | `.github/skills/` |
| Instructions | `.github/instructions/` |

### Labels

**Type Labels**: `type:epic`, `type:feature`, `type:story`, `type:bug`, `type:spike`, `type:docs`

**Priority Labels**: `priority:p0`, `priority:p1`, `priority:p2`, `priority:p3`

**Workflow Labels**: `needs:ux`, `needs:help`, `needs:changes`

---

**See Also**: [Skills.md](Skills.md) for production code standards