# Session Manager: Context Preservation Across Handoffs

> **Purpose**: Capture and restore session context across agent handoffs to maintain continuity and prevent information loss.  
> **Usage**: Guidelines for capturing session state, generating summaries, and restoring context for the next agent.

---

## Overview

**Problem**: Context is lost between agent handoffs, causing:
- Repeated research
- Inconsistent decisions
- Lost rationale for choices
- "Cold start" for new agents

**Solution**: Structured session summaries stored in GitHub Issue comments that preserve:
- Key decisions made
- Guidelines applied
- Context state at handoff
- Learnings for future reference

---

## Session Context Capture

### When to Capture

**Mandatory Capture Points**:
- ✅ Agent completes work (before handoff)
- ✅ Session timeout (15+ minutes idle)
- ✅ Error/exception occurs
- ✅ User explicitly ends session

**Optional Capture Points**:
- After major milestone (e.g., all tests passing)
- Before risky operation (e.g., database migration)
- Mid-session checkpoint (every 30 minutes)

---

## Session Summary Template

### Standard Format

```markdown
## 🧠 Session Context Summary

**Session ID**: {timestamp}-{agent-role}  
**Issue**: #{issue-id}  
**Agent**: {role} (Product Manager | Architect | UX Designer | Engineer | Reviewer)  
**Duration**: {start-time} - {end-time} ({duration})  
**Status**: {completed | in-progress | blocked | error}

---

### 📋 Work Completed

**Deliverables**:
- {Deliverable 1}: {status} ✅/⏳/❌
- {Deliverable 2}: {status}
- {Deliverable 3}: {status}

**Files Modified**:
- `{path/to/file1.cs}` - {description}
- `{path/to/file2.cs}` - {description}

**Commits**:
- {commit-sha}: {commit-message}

---

### 🎯 Decisions Made

| Decision | Rationale | Alternatives Rejected | Impact |
|----------|-----------|----------------------|--------|
| {Decision 1} | {Why chosen} | {What was rejected and why} | {Consequences} |
| {Decision 2} | {Why chosen} | {What was rejected and why} | {Consequences} |

**Examples**:
- **Use JWT for auth**: Industry standard, stateless, easy integration | Rejected: Session cookies (not scalable) | All services must validate JWT
- **PostgreSQL over MongoDB**: Relational data, ACID compliance needed | Rejected: MongoDB (schema flexibility not needed) | Must design normalized schema

---

### 📚 Guidelines Applied

**Skills Referenced**:
- ✅ Skill #02 (Testing): Achieved 85% coverage (target: 80%)
- ✅ Skill #04 (Security): All inputs validated, SQL parameterized
- ✅ Skill #09 (API Design): RESTful endpoints, proper status codes
- ⚠️ Skill #05 (Performance): Deferred caching optimization to next sprint
- ❌ Skill #15 (Logging): Not applicable for this task

**Compliance Notes**:
- Input validation: 12 validators added
- SQL safety: 8 queries parameterized
- XML docs: 15 public methods documented
- Test coverage: 127 tests written (85% coverage)

---

### 🔄 Context for Next Agent

**Handoff To**: {next-agent-role}

**What They Need to Know**:
- {Critical info 1}
- {Critical info 2}
- {Critical info 3}

**Prerequisites Met**:
- ✅ {Prerequisite 1}
- ✅ {Prerequisite 2}
- ⏳ {Prerequisite 3} (in progress)

**Open Questions**:
- [ ] {Question 1} - needs {person/team} input
- [ ] {Question 2} - blocked by {dependency}

**Known Issues**:
- ⚠️ Edge case with null values in {location} - TODO: Handle in next iteration
- ⚠️ Performance concern with {operation} - consider optimization

**Related Issues**:
- Parent: #{parent-issue}
- Blocked by: #{blocking-issue}
- Blocks: #{blocked-issue}

---

### 📖 Learnings & Patterns

**What Worked Well**:
- ✅ {Pattern 1}: {Why it worked}
- ✅ {Pattern 2}: {Benefits observed}

**What to Avoid**:
- ❌ {Anti-pattern 1}: {Why it failed}
- ❌ {Anti-pattern 2}: {Problems caused}

**Recommendations**:
- 💡 {Recommendation 1}
- 💡 {Recommendation 2}

---

### 📊 Context Health at Handoff

**Token Usage**:
- Total: {used-tokens} / 72,000 ({percentage}%)
- Tier 1 (Critical): {tier1-tokens}
- Tier 2 (Important): {tier2-tokens}
- Tier 3 (Relevant): {tier3-tokens}
- Tier 4 (Supplementary): {tier4-tokens}

**Context Quality**:
- Relevance Score: {score} (target: > 0.8)
- Recency: {turns-ago} turns ago
- Duplication: {duplicate-count} duplicates detected
- Status: 🟢 Healthy | 🟡 Warning | 🔴 Critical

**Warnings**:
- {Warning 1}
- {Warning 2}

---

### 🔗 References

**Documentation**:
- PRD: [docs/prd/PRD-{issue}.md](../docs/prd/PRD-{issue}.md)
- ADR: [docs/adr/ADR-{issue}.md](../docs/adr/ADR-{issue}.md)
- Tech Spec: [docs/specs/SPEC-{issue}.md](../docs/specs/SPEC-{issue}.md)
- UX Design: [docs/ux/UX-{issue}.md](../docs/ux/UX-{issue}.md)
- Review: [docs/reviews/REVIEW-{issue}.md](../docs/reviews/REVIEW-{issue}.md)

**Skills Applied**:
- [skills/02-testing.md](../skills/02-testing.md)
- [skills/04-security.md](../skills/04-security.md)

---

**Next Action**: {next-agent-role} will {next-action}  
**ETA**: {estimated-time}  
**Handoff Complete**: ✅
```

---

## Role-Specific Templates

### Product Manager Session Summary

```markdown
## 🧠 PM Session Context Summary

**Session ID**: 2026-01-20T14:30:00-PM  
**Issue**: #77  
**Agent**: Product Manager  
**Duration**: 14:30 - 16:45 (2h 15m)  
**Status**: Completed ✅

---

### 📋 Work Completed

**Deliverables**:
- PRD Created: ✅ [docs/prd/PRD-77.md](../docs/prd/PRD-77.md)
- Feature Breakdown: ✅ 5 features identified
- User Stories: ✅ 12 stories created
- Backlog Organized: ✅ All issues created and linked

**Issues Created**:
- Epic #77: Context Management System
- Feature #78: Auto-Load Guidelines
- Feature #79: Context Budget Tracker
- Feature #80: Session Manager
- Feature #81: Guideline Discoverability
- Feature #82: Compliance Validator

---

### 🎯 Decisions Made

| Decision | Rationale | Alternatives Rejected | Impact |
|----------|-----------|----------------------|--------|
| Implement in 2 phases | Deliver value incrementally, get feedback early | Single release (too risky) | Phase 1 in Week 1-2, Phase 2 in Week 3-4 |
| Token budget = 72K | Leave 28K for output, matches Claude limits | 100K (no output buffer) | Engineers must monitor budget actively |
| Store summaries in issue comments | Native GitHub, searchable, persistent | Separate DB (added complexity) | All context accessible via GitHub UI |

---

### 📚 Guidelines Applied

- ✅ Skill #01 (Core Principles): Applied separation of concerns (context mgmt vs enforcement)
- ✅ Skills.md structure: Followed existing patterns for new docs

---

### 🔄 Context for Next Agent

**Handoff To**: Architect + UX Designer (parallel)

**What They Need to Know**:
- Focus on Phase 1 & 2 only (defer Phase 3-4)
- Context budget is hard limit (72K tokens)
- Must integrate with existing Skills.md structure
- Session summaries stored as GitHub Issue comments

**Prerequisites Met**:
- ✅ PRD complete and reviewed
- ✅ All child issues created
- ✅ Backlog prioritized

**Open Questions**:
- [ ] Should we build VS Code extension (Phase 4)? - Defer to later
- [ ] How to handle Python projects? - Use same principles, adapt syntax

---

### 📖 Learnings

**What Worked Well**:
- ✅ Task-based skill routing: Clear mapping reduces cognitive load
- ✅ Token budgets: Explicit limits prevent overflow

**Recommendations**:
- 💡 Add context health dashboard to VS Code extension (future)
- 💡 Consider auto-pruning at 80% threshold

---

### 📊 Context Health at Handoff

**Token Usage**: 28K / 72K (39%) 🟢  
**Status**: Healthy, ready for next agents

---

**Next Action**: Architect designs context manager, UX Designer creates UI mockups  
**Handoff Complete**: ✅ (Added `orch:pm-done` label)
```

---

### Engineer Session Summary

```markdown
## 🧠 Engineer Session Context Summary

**Session ID**: 2026-01-20T16:00:00-ENG  
**Issue**: #78  
**Agent**: Engineer  
**Duration**: 16:00 - 18:30 (2h 30m)  
**Status**: Completed ✅

---

### 📋 Work Completed

**Deliverables**:
- Code Implementation: ✅ Context manager classes
- Unit Tests: ✅ 45 tests written (87% coverage)
- Integration Tests: ✅ 12 tests written
- XML Documentation: ✅ All public APIs documented

**Files Modified**:
- `src/Context/ContextManager.cs` - Core context management logic
- `src/Context/TokenBudget.cs` - Budget tracking and validation
- `src/Context/ContextLayer.cs` - Tier-based layering
- `tests/Context/ContextManagerTests.cs` - Unit tests
- `tests/Context/ContextIntegrationTests.cs` - Integration tests

**Commits**:
- `a3f4b21`: feat: implement context manager core (#78)
- `c8d2e45`: test: add context manager unit tests (#78)
- `f1a3d67`: docs: add XML documentation for context APIs (#78)

---

### 🎯 Decisions Made

| Decision | Rationale | Alternatives Rejected | Impact |
|----------|-----------|----------------------|--------|
| Use dictionary for tier storage | Fast lookups, flexible keys | List (slow for retrieval) | O(1) tier access |
| Token counting via regex | Simple, no external deps | ML-based tokenizer (overkill) | ~95% accuracy (acceptable) |
| Prune at 80% threshold | Prevents overflow, safety buffer | 90% (too risky) | More aggressive pruning |

---

### 📚 Guidelines Applied

**Skills Referenced**:
- ✅ Skill #01 (Core Principles): SOLID, single responsibility per class
- ✅ Skill #02 (Testing): 87% coverage (target: 80%)
- ✅ Skill #04 (Security): Validated all input parameters
- ✅ Skill #05 (Performance): O(1) lookups, efficient pruning
- ✅ Skill #11 (Documentation): XML docs on all public methods

**Compliance Notes**:
- Input validation: 8 parameter checks added
- SQL safety: N/A (no database access)
- Test coverage: 87% (45 unit + 12 integration tests)
- XML docs: 23 public methods documented

---

### 🔄 Context for Next Agent

**Handoff To**: Reviewer

**What They Need to Know**:
- Implementation complete, all tests passing
- 87% coverage exceeds 80% target
- Performance: O(1) tier access, O(n log n) pruning
- Edge case handled: Null token counts default to 0

**Prerequisites Met**:
- ✅ Code follows Skills.md standards
- ✅ All tests passing
- ✅ Security scan passed
- ✅ XML docs complete

**Known Issues**:
- ⚠️ Token counting is regex-based (~95% accuracy) - Consider ML tokenizer if precision needed
- ⚠️ No integration with VS Code yet - Planned for Phase 4

---

### 📖 Learnings

**What Worked Well**:
- ✅ TDD approach: Wrote tests first, caught 3 bugs early
- ✅ Dictionary for tiers: Clean, performant, extensible

**What to Avoid**:
- ❌ Don't over-engineer token counting - regex is sufficient

**Recommendations**:
- 💡 Add telemetry for pruning frequency analysis
- 💡 Consider async pruning for large contexts

---

### 📊 Context Health at Handoff

**Token Usage**: 42K / 72K (58%) 🟢  
**Context Quality**: Relevance 0.91, No duplicates  
**Status**: Healthy

---

**Next Action**: Reviewer will audit code quality and security  
**ETA**: <30s (automated)  
**Handoff Complete**: ✅ (Added `orch:engineer-done` label)
```

---

## Session Restoration Protocol

### For Next Agent (Reading Previous Summary)

**Steps**:

1. **Locate Session Summary**:
   ```json
   { "tool": "issue_read", "args": { "issue_number": 77 } }
   ```
   - Look for comments with "🧠 Session Context Summary" header
   - Read most recent summary from previous agent

2. **Extract Key Information**:
   - Decisions made (what & why)
   - Prerequisites met (what's ready)
   - Open questions (what's blocked)
   - Context state (token usage, health)

3. **Load Required Context**:
   - Tier 1: Issue description, orchestration state
   - Tier 2: Task-specific skills (from Skills.md Quick Reference)
   - Tier 3: Referenced documentation (PRD, ADR, Spec, UX)

4. **Verify Prerequisites**:
   ```markdown
   Checking prerequisites from previous summary:
   ✅ orch:architect-done label present
   ✅ orch:ux-done label present
   ✅ Tech spec exists at docs/specs/SPEC-78.md
   ✅ UX design exists at docs/ux/UX-78.md
   → All prerequisites met, proceeding
   ```

5. **Continue Work**:
   - Apply learnings from "What Worked Well"
   - Avoid anti-patterns from "What to Avoid"
   - Address "Known Issues" if relevant
   - Answer "Open Questions" if possible

---

## Automated Summary Generation

### Trigger Points

```yaml
# .github/workflows/session-summary.yml
on:
  issue_comment:
    types: [created]
    
jobs:
  auto-summary:
    if: contains(github.event.comment.body, 'orch:') && contains(github.event.comment.body, '-done')
    runs-on: ubuntu-latest
    steps:
      - name: Generate Session Summary
        run: |
          # Extract context from previous comments
          # Generate structured summary
          # Post as new comment
```

### Summary Quality Checks

Before posting summary:
- ✅ All mandatory fields populated
- ✅ At least 1 decision documented
- ✅ At least 1 guideline referenced
- ✅ Context health metrics included
- ✅ Next agent identified

---

## Integration with Orchestration

### Handoff Flow with Session Context

```
Engineer completes work:
  ↓
1. Generate session summary
2. Post as issue comment
3. Add orch:engineer-done label
4. Update issue status to "In Review"
  ↓
Orchestrator detects label change:
  ↓
5. Trigger Reviewer workflow
  ↓
Reviewer starts:
  ↓
6. Read Engineer's session summary
7. Extract key decisions & context
8. Load relevant skills
9. Begin code review with full context
```

---

## Storage & Archival

### Where Session Summaries Live

**Primary Storage**: GitHub Issue Comments
- ✅ Native to workflow
- ✅ Searchable via GitHub UI
- ✅ Version controlled
- ✅ Accessible to all agents

**Secondary Storage** (Future):
- Database for analytics
- Vector store for semantic search
- Git repository (docs/sessions/)

### Retention Policy

| Age | Action | Storage |
|-----|--------|---------|
| < 30 days | Keep in issue comments | GitHub |
| 30-90 days | Archive to docs/sessions/ | Git |
| > 90 days | Compress & store | S3/Archive |

---

## Best Practices

### For All Agents

1. **Capture Rationale**: Always document "why" decisions were made
2. **Be Specific**: "Used PostgreSQL" → "Used PostgreSQL for ACID compliance and relational data"
3. **Link Resources**: Reference docs, commits, related issues
4. **Flag Issues**: Document known problems for next agent
5. **Share Learnings**: What worked, what didn't

### For Engineers

1. **Document Technical Decisions**: Architecture choices, algorithm selection, library choices
2. **Include Performance Notes**: Time complexity, memory usage, optimization opportunities
3. **Security Considerations**: Threat model, mitigation strategies
4. **Test Strategy**: Coverage approach, edge cases tested

### For Reviewers

1. **Document Findings**: Issues found, severity, recommended fixes
2. **Quality Assessment**: Code standards, test quality, security posture
3. **Approval Criteria**: What must be fixed vs. nice-to-have
4. **Follow-up Items**: Technical debt, future improvements

---

## References

- **Context Management**: [.github/context-manager.md](context-manager.md)
- **Orchestration**: [AGENTS.md §Handoff Protocol](../AGENTS.md#-handoff-protocol-mandatory-steps)
- **Issue Workflow**: [AGENTS.md §Issue-First Workflow](../AGENTS.md#-issue-first-workflow)

---

**Version**: 1.0  
**Last Updated**: January 20, 2026  
**Related Issue**: #77
