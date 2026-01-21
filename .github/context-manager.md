# Context Manager: Token Budget & Context Health

> **Purpose**: Intelligent context management to optimize token usage and prevent context overflow.  
> **Usage**: Guidelines for AI agents to manage context budget, layer content by priority, and maintain context health.

---

## Context Budget Specification

### Token Allocation

```
┌─────────────────────────────────────────────────────────────┐
│                  Context Budget Breakdown                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Model: Claude Sonnet 4.5 (128K context window)            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ INPUT BUDGET: 100,000 tokens (reserve 28K for output) │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Allocation by Tier:                                        │
│  • Tier 1 (Critical): 5,000 tokens (always loaded)         │
│  • Tier 2 (Important): 20,000 tokens (task-specific)       │
│  • Tier 3 (Relevant): 35,000 tokens (on-demand)            │
│  • Tier 4 (Supplementary): 10,000 tokens (optional)        │
│  • Buffer (safety margin): 2,000 tokens                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Total Usable: 72,000 tokens                                │
│                                                              │
│  OUTPUT RESERVED: 28,000 tokens                             │
│  TOTAL: 100,000 tokens                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle**: Never exceed 72K tokens for input to leave room for comprehensive output.

---

## Automatic Context Layering

### Tier 1: Critical Context (Always Loaded - 5K tokens)

**Content**:
- System prompt (agent role, security rules)
- Current issue description (#issue-id)
- Orchestration state (labels, prerequisites)
- Security constraints (OWASP Top 10 checklist)

**Characteristics**:
- ✅ Never pruned
- ✅ Loaded at session start
- ✅ Highest priority
- ❌ Cannot be archived

**Example**:
```markdown
# System Prompt (2K tokens)
You are an Engineer agent. Follow Skills.md standards.
Security: Validate all inputs, parameterize SQL, no hardcoded secrets.

# Current Issue (2K tokens)
Issue #77: [Feature] Context Management System
Description: Implement intelligent context management...
Labels: type:feature, priority:p1

# Orchestration State (1K tokens)
Parent Epic: #50
Prerequisites: ✅ orch:architect-done, ✅ orch:ux-done
Status: In Progress
```

---

### Tier 2: Important Context (Auto-Loaded - 20K tokens)

**Content**:
- Relevant skill documents (based on task type)
- Current file being modified
- Recent test results (if any failed)
- Tech Spec/ADR for current feature

**Characteristics**:
- ✅ Loaded based on task classification
- ✅ High priority, rarely pruned
- ⚠️ Can be summarized if >90% budget used

**Task-Based Loading** (see [Skills.md Quick Reference](../Skills.md#-quick-reference-by-task-type)):

| Task Type | Auto-Load Skills | Tokens |
|-----------|------------------|--------|
| API Implementation | #09, #04, #02, #11 | 18K |
| Database Changes | #06, #04, #02 | 15K |
| Security Feature | #04, #10, #02, #13, #15 | 20K |
| Bug Fix | #03, #02, #15 | 10K |
| Performance | #05, #06, #02, #15 | 15K |
| Documentation | #11 | 5K |

**Example**:
```markdown
# Task: API Implementation → Auto-load skills/09, 04, 02, 11

# Skills Context (18K tokens)
- skills/09-api-design.md (5K): REST patterns, versioning...
- skills/04-security.md (6K): Input validation, auth...
- skills/02-testing.md (4K): Controller tests, integration...
- skills/11-documentation.md (3K): XML docs, OpenAPI...

# Current File (2K tokens)
src/Controllers/UserController.cs (currently editing)
```

---

### Tier 3: Relevant Context (On-Demand - 35K tokens)

**Content**:
- Related code files (semantic search results)
- Documentation (PRD, ADR, Spec)
- Similar code examples
- Integration test fixtures

**Characteristics**:
- ✅ Retrieved when needed (not pre-loaded)
- ⚠️ First to be pruned if budget exceeded
- 📊 Relevance-scored (only include if score > 0.7)

**Retrieval Strategy**:
```json
// Semantic search for related code
{ "tool": "semantic_search", "query": "OAuth implementation examples" }

// Result: Top 3 files by relevance score
// 1. src/Auth/OAuthController.cs (score: 0.92) - 8K tokens
// 2. tests/Auth/OAuthTests.cs (score: 0.87) - 5K tokens  
// 3. docs/adr/ADR-50.md (score: 0.81) - 3K tokens
// Total: 16K tokens
```

---

### Tier 4: Supplementary Context (Optional - 10K tokens)

**Content**:
- Older conversation turns (>5 turns back)
- Supplementary examples
- Full documentation (not excerpts)
- Historical context (previous sessions)

**Characteristics**:
- ⚠️ Include only if budget allows
- ⚠️ First to be archived
- 📝 Can be summarized to save tokens

**Summarization Example**:
```markdown
# Original (10K tokens)
[Full conversation history from turns 1-10]

# Summarized (2K tokens)
## Previous Session Summary
- Implemented OAuth login (Turn 1-3)
- Added JWT token validation (Turn 4-6)
- Fixed token refresh bug (Turn 7-10)
Key Decision: Use 15-min access token expiry
```

---

## Context Pruning Strategy

### Trigger Conditions

| Condition | Action | Affected Tiers |
|-----------|--------|----------------|
| Context usage > 80% (58K/72K) | Prune Tier 4 (archive oldest) | Tier 4 only |
| Context usage > 90% (65K/72K) | Prune Tier 3 (remove low-relevance) | Tier 3, 4 |
| Context usage > 95% (68K/72K) | Compress Tier 2 (summarize skills) | Tier 2, 3, 4 |
| Context usage > 100% (72K+) | **ERROR** - Reject new content | All tiers locked |

### Pruning Algorithm

```
1. Calculate current usage: sum(tier1 + tier2 + tier3 + tier4)
2. If usage > 80%:
   a. Sort Tier 4 by recency (oldest first)
   b. Remove oldest items until usage < 75%
3. If usage > 90%:
   a. Sort Tier 3 by relevance score (lowest first)
   b. Remove items with score < 0.7 until usage < 80%
4. If usage > 95%:
   a. Summarize Tier 2 skill docs (keep key points only)
   b. Target: Reduce Tier 2 from 20K → 10K tokens
5. If usage > 100%:
   a. Log error: "Context budget exceeded"
   b. Suggest: "Prune context or start new session"
```

### Never Prune

- ✅ Tier 1 (critical) - always preserved
- ✅ Current issue description
- ✅ Security rules
- ✅ Orchestration state

---

## Context Health Monitoring

### Health Metrics

```json
{
  "context_health": {
    "status": "healthy",
    "token_usage": {
      "total": 48000,
      "budget": 72000,
      "percentage": 67,
      "breakdown": {
        "tier1_critical": 5000,
        "tier2_important": 18000,
        "tier3_relevant": 20000,
        "tier4_supplementary": 5000
      }
    },
    "relevance_score": 0.85,
    "recency": {
      "turns_ago": 3,
      "status": "fresh"
    },
    "duplication": {
      "detected": false,
      "count": 0
    },
    "warnings": []
  }
}
```

### Health Thresholds

| Status | Token Usage | Relevance Score | Recency | Duplication |
|--------|-------------|-----------------|---------|-------------|
| 🟢 **Healthy** | 60-80% | > 0.8 | < 5 turns | None |
| 🟡 **Warning** | 80-90% | 0.6-0.8 | 5-10 turns | < 5% overlap |
| 🔴 **Critical** | > 90% | < 0.6 | > 10 turns | > 5% overlap |

### Warning Actions

**Token Usage > 80%**:
```
⚠️ Warning: Context approaching budget limit (58K/72K = 81%)
Action: Prune Tier 4 (supplementary context)
Expected savings: 8K tokens → 50K/72K = 69%
```

**Relevance Score < 0.7**:
```
⚠️ Warning: Low relevance content detected
Action: Review Tier 3 items, remove score < 0.7
Affected items: 3 files (12K tokens)
```

**Recency > 10 turns**:
```
⚠️ Warning: Stale context detected (15 turns old)
Action: Archive or summarize old conversation
Affected: Turns 1-10 (8K tokens) → Summary (1K tokens)
```

**Duplication Detected**:
```
⚠️ Warning: Duplicate content found
Action: Remove duplicates, keep most recent version
Affected: skills/04-security.md loaded twice (6K tokens saved)
```

---

## Context Gates (Pre-Load Validation)

Before adding content to context, pass through these gates:

### Gate 1: Relevance Filter

```
Question: Is this content relevant to current task?
Method: Semantic similarity > 0.7
✅ Pass → Continue to Gate 2
❌ Reject → Discard content, do not load
```

### Gate 2: Recency Check

```
Question: Is this information current?
Method: Last updated < 90 days (configurable)
✅ Pass → Continue to Gate 3
⚠️ Warn → Flag as potentially outdated, continue with warning
```

### Gate 3: Token Budget Check

```
Question: Will this fit in remaining budget?
Current Usage: 65K / 72K tokens
Content Size: 10K tokens
✅ Pass (fits) → Continue to Gate 4
❌ Reject (exceeds) → Trigger pruning first, then retry
```

### Gate 4: Duplication Check

```
Question: Is this already in context?
Method: Hash comparison or fuzzy matching
✅ Pass → Add to context
❌ Reject → Skip duplicate, use existing version
```

---

## Usage Guidelines for Agents

### At Session Start

1. **Initialize Context Budget**:
   ```json
   {
     "budget": 72000,
     "used": 0,
     "available": 72000
   }
   ```

2. **Load Tier 1 (Critical)**:
   - System prompt
   - Current issue
   - Orchestration state
   - **Tokens used**: 5K

3. **Classify Task & Auto-Load Tier 2**:
   - Identify task type (API, Database, Security, etc.)
   - Load corresponding skills from [Skills.md Quick Reference](../Skills.md#-quick-reference-by-task-type)
   - **Tokens used**: 15-20K (varies by task)

4. **Check Budget**:
   ```
   Total: 5K + 18K = 23K tokens
   Available: 72K - 23K = 49K tokens remaining ✅
   ```

### During Work

1. **Before Loading New Content**:
   - Check current usage: `current_tokens / 72000`
   - If > 80%, trigger pruning
   - Pass through context gates

2. **Monitor Health**:
   - Track relevance scores
   - Check for duplicates
   - Monitor recency

3. **Prune Proactively**:
   - Don't wait until 100%
   - Prune at 80% threshold
   - Archive instead of deleting

### Before Handoff

1. **Generate Session Summary** (see [.github/session-manager.md](session-manager.md)):
   - Capture key decisions
   - Document guidelines applied
   - Note context state

2. **Archive Non-Critical Context**:
   - Move Tier 3/4 to issue comments
   - Keep only Tier 1/2 for next agent

3. **Report Context Health**:
   ```markdown
   ## Context Health at Handoff
   - Token usage: 45K / 72K (63%) ✅
   - Relevance score: 0.87 ✅
   - Warnings: None
   - Ready for next agent: ✅
   ```

---

## Integration with Orchestration

### Product Manager → Architect Handoff

```markdown
Context passed:
- Issue #50 description (Tier 1)
- PRD document (Tier 2)
- Skills #01, #08 (Tier 2)
Token usage: 28K / 72K = 39%
```

### Architect → Engineer Handoff

```markdown
Context passed:
- Issue #50 description (Tier 1)
- ADR + Tech Spec (Tier 2)
- Skills #02, #04, #09, #11 (Tier 2)
- Code examples (Tier 3)
Token usage: 42K / 72K = 58%
```

### Engineer → Reviewer Handoff

```markdown
Context passed:
- Issue #50 description (Tier 1)
- Code diff (Tier 2)
- Skills #02, #04, #18 (Tier 2)
- Test results (Tier 2)
Token usage: 35K / 72K = 49%
```

---

## Tools Integration

### VS Code Extension (Future)

```
┌─────────────────────────────────────────────────────┐
│ Context Budget: ████████░░ 58K / 72K (81%)         │
│ ⚠️ Approaching limit - consider pruning             │
├─────────────────────────────────────────────────────┤
│ Loaded Guidelines (18K tokens)                      │
│ ✅ #09 API Design (5K)                              │
│ ✅ #04 Security (6K)                                │
│ ✅ #02 Testing (4K)                                 │
│ ✅ #11 Documentation (3K)                           │
├─────────────────────────────────────────────────────┤
│ Available (click to load)                           │
│ ⬜ #05 Performance                                  │
│ ⬜ #06 Database                                     │
└─────────────────────────────────────────────────────┘
```

---

## References

- **Task Classification**: [Skills.md Quick Reference](../Skills.md#-quick-reference-by-task-type)
- **Session Management**: [.github/session-manager.md](session-manager.md)
- **Context Engineering**: [docs/context-engineering.md](../docs/context-engineering.md)

---

**Version**: 1.0  
**Last Updated**: January 20, 2026  
**Related Issue**: #77
