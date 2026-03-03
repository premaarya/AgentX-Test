# ADR-47: Security Hardening and Agentic Loop Architecture Decisions

**Status**: Accepted
**Date**: 2026-03-03
**Author**: Solution Architect Agent
**Epic**: #47
**Issue**: #47
**PRD**: [PRD-47.md](../prd/PRD-47.md)

---

## Table of Contents

1. [Context](#context)
2. [Decisions](#decisions)
   - [ADR-47.1: Allowlist-over-Denylist for Command Security](#adr-471-allowlist-over-denylist-for-command-security)
   - [ADR-47.2: Dual-Ledger Pattern for Progress Tracking](#adr-472-dual-ledger-pattern-for-progress-tracking)
   - [ADR-47.3: Promise.allSettled for Parallel Tool Execution](#adr-473-promiseallsettled-for-parallel-tool-execution)
   - [ADR-47.4: JSONL for Persistent Memory Format](#adr-474-jsonl-for-persistent-memory-format)
   - [ADR-47.5: Structured JSON Logging with File Rotation](#adr-475-structured-json-logging-with-file-rotation)
3. [Consequences (Cross-Cutting)](#consequences-cross-cutting)
4. [Implementation](#implementation)
5. [References](#references)
6. [Review History](#review-history)

---

## Context

AgentX's agentic loop grants LLM-driven agents the ability to execute shell commands, read/write files, and interact with external services. The current security model relies on a 4-entry denylist of dangerous commands in toolEngine.ts (line ~299) with no defense-in-depth measures. Additionally, the agentic loop executes tool calls sequentially, provides no progress tracking or stall detection, and has limited resilience to transient LLM failures.

**Requirements (from PRD-47):**

- Replace trivial denylist with allowlist-based command validation (defense-in-depth)
- Add secret redaction to prevent credential leaks in logs
- Add action reversibility classification for informed user decisions
- Add path sandboxing to prevent agent file exfiltration
- Add dual-ledger progress tracking with stall detection
- Add parallel tool execution for independent tool calls
- Add LLM retry with exponential backoff for transient failures
- Add structured JSON logging with file rotation for enterprise audit trails
- Add persistent cross-session memory for agent knowledge retention

**Constraints:**

- Must maintain backward compatibility with existing tool definitions and agent configurations
- Must use VS Code Extension API (no new extension host processes)
- Must follow existing TypeScript patterns (readonly interfaces, pure functions)
- Configuration via standard VS Code settings API
- All code ASCII-only
- No new external npm dependencies

**Background:**

The existing denylist approach (4 patterns: "rm -rf /", "format c:", "drop database", "git reset --hard") is trivially bypassed via encoding, aliasing, or compound commands. OWASP Command Injection Prevention guidelines recommend allowlist-over-denylist as a fundamental security principle. The agentic loop's sequential tool execution, lack of retry logic, and absence of structured logging prevent AgentX from meeting enterprise-grade reliability and auditability standards.

---

## Decisions

### ADR-47.1: Allowlist-over-Denylist for Command Security

#### Decision

We will replace the primary command validation strategy from denylist-only to **allowlist-primary with denylist-fallback**. The existing 4-entry denylist is retained as Layer 1 (hard block), and a configurable allowlist becomes Layer 2 (auto-approve or prompt). Unknown commands always require user confirmation.

#### Options Considered

**Option A: Enhanced Denylist (extend current approach)**

Expand the denylist from 4 to 50+ patterns covering more dangerous commands.

Pros:
- Minimal code change
- No disruption to existing workflows
- Easy to understand

Cons:
- Fundamentally flawed: cannot enumerate all dangerous commands
- Bypassed by encoding, aliasing, or novel commands
- Does not follow security best practices (OWASP recommends allowlist)
- False sense of security

Effort: S | Risk: High

**Option B: Allowlist-only (strict)**

Only allowlisted commands execute. All others are blocked with no override.

Pros:
- Maximum security
- Simple implementation
- Follows principle of least privilege

Cons:
- Too restrictive for developer tools (agents need flexibility)
- Users would need to manually allowlist every new command
- High friction leading to user frustration and low adoption

Effort: M | Risk: Medium

**Option C: Allowlist-primary with denylist-fallback + user confirmation (SELECTED)**

Denylist hard-blocks known-dangerous commands. Allowlist auto-approves known-safe commands. Unknown commands prompt user with reversibility classification.

Pros:
- Defense-in-depth: two independent validation layers
- Balanced security and usability
- Unknown commands are not blocked, just gated behind confirmation
- OWASP-compliant allowlist approach
- Extensible via VS Code settings
- Compound command splitting prevents bypass via chaining

Cons:
- More complex implementation than either option alone
- Requires careful default allowlist curation
- Confirmation dialogs may be disruptive for frequent unknown commands

Effort: M | Risk: Low

#### Rationale

We chose **Option C** because:

1. **OWASP Compliance**: The allowlist-over-denylist principle is an industry standard for command injection prevention. A denylist alone is trivially bypassed.
2. **Balanced UX**: Auto-approving known-safe commands (git, npm, dotnet) maintains developer velocity while gating unknown commands behind an informed confirmation dialog.
3. **Defense in Depth**: Two independent layers -- denylist catches known-dangerous even if allowlist is misconfigured; allowlist catches unknown commands that denylist misses.
4. **Extensibility**: Users can extend the allowlist via VS Code settings without modifying source code, adapting to project-specific toolchains.
5. **Compound Analysis**: Splitting compound commands on ; && || | and validating each sub-command independently closes a major bypass vector.

---

### ADR-47.2: Dual-Ledger Pattern for Progress Tracking

#### Decision

We will implement a **dual-ledger progress tracking system** with a TaskLedger (strategic context) and a ProgressLedger (tactical execution state). Stall detection triggers automatic replanning using TaskLedger context.

#### Options Considered

**Option A: Simple step counter**

Track iteration count and time elapsed. No structural awareness of the plan.

Pros:
- Trivial implementation
- Low overhead

Cons:
- Cannot distinguish productive work from spinning
- No replanning capability
- No context for why the agent is stuck

Effort: S | Risk: Medium

**Option B: Dual-ledger (TaskLedger + ProgressLedger) (SELECTED)**

TaskLedger holds strategic context (objective, facts, assumptions, plan). ProgressLedger holds tactical state (current step, history, stall count, timestamps). Stall detection at threshold N triggers replanning using TaskLedger context.

Pros:
- Separation of strategic and tactical state enables intelligent replanning
- Stall detection based on consecutive failures (not just iteration count)
- Time-based stale detection catches hanging operations
- TaskLedger provides LLM with full context for plan revision
- Visible in ThinkingLog for user monitoring

Cons:
- More complex than simple counter
- LLM replanning consumes additional tokens
- ProgressLedger must be updated on every step (minor overhead)

Effort: M | Risk: Low

**Option C: Full planning framework (DAG-based)**

Model the plan as a directed acyclic graph with dependencies between steps.

Pros:
- Most accurate dependency tracking
- Enables parallel step execution

Cons:
- Over-engineered for current needs
- LLM plans are sequential narratives, not DAGs
- High implementation complexity

Effort: XL | Risk: High

#### Rationale

We chose **Option B** because:

1. **Right Abstraction Level**: The dual-ledger separates "what are we trying to do" (TaskLedger) from "how far have we gotten" (ProgressLedger). This matches how autonomous agent systems track progress in the research literature.
2. **Intelligent Replanning**: When stalled, the LLM receives the full objective, known facts, and last N errors -- enough context to generate a revised plan without starting from scratch.
3. **Configurable Sensitivity**: The stall threshold (default 3) and stale timeout (default 60s) are configurable, allowing users to tune sensitivity per workflow.
4. **Incremental Complexity**: Adds meaningful capability without the over-engineering of a DAG-based planner. Can be extended to DAG later if needed.

---

### ADR-47.3: Promise.allSettled for Parallel Tool Execution

#### Decision

We will use **Promise.allSettled()** to execute independent tool calls concurrently when the LLM returns multiple tool calls in a single response. A lightweight dependency detection heuristic determines whether tools can run in parallel.

#### Options Considered

**Option A: Always sequential (current behavior)**

Execute tool calls one at a time in the order returned by the LLM.

Pros:
- Simple, predictable
- No race condition risk
- Current behavior preserved

Cons:
- Wastes time when tools are independent
- LLMs increasingly return multiple independent calls
- Performance bottleneck for multi-tool responses

Effort: None | Risk: None

**Option B: Promise.all (fail-fast)**

Execute all tools concurrently with Promise.all. If any fails, all fail.

Pros:
- Maximum parallelism
- Simple API

Cons:
- One failure cancels all concurrent tools
- Partial results lost on any error
- Inappropriate for tool execution where individual failures should be reported

Effort: S | Risk: Medium

**Option C: Promise.allSettled (independent completion) (SELECTED)**

Execute independent tools concurrently with Promise.allSettled. Each tool completes or fails independently. Results collected in original order.

Pros:
- One failure does not cancel others
- All results (success + failure) preserved
- Results returned in original order regardless of completion order
- Standard JavaScript API -- no custom concurrency primitives
- Transparent to agents: same results, faster completion

Cons:
- Need dependency detection heuristic (lightweight but imperfect)
- Sequential fallback needed when dependencies detected
- Slightly more complex result handling than sequential

Effort: M | Risk: Low

#### Rationale

We chose **Option C** because:

1. **Fault Isolation**: Promise.allSettled ensures that a failing file_read does not cancel a concurrent grep_search. Each tool call's result (or error) is delivered to the LLM independently.
2. **Transparent Speedup**: From the LLM's perspective, results appear in the same order. The only difference is wall-clock time.
3. **Standard API**: No custom concurrency primitives or worker threads needed. Promise.allSettled is built into JavaScript.
4. **Safe Fallback**: When the dependency heuristic detects potential data flow between calls, the system falls back to sequential execution. Wrong dependency detection errs on the side of caution (sequential), never on the side of race conditions.

---

### ADR-47.4: JSONL for Persistent Memory Format

#### Decision

We will use **JSON Lines (JSONL) format** for the persistent cross-session memory store at `.agentx/memory/observations.jsonl`. One JSON object per line, append-only writes.

#### Options Considered

**Option A: Single JSON file**

Store all memory entries in a single JSON array.

Pros:
- Simple to read/parse
- Standard format

Cons:
- Must read and rewrite entire file on every append
- Poor performance at scale (>1000 entries)
- Corruption risk: partial write corrupts entire store
- Not suitable for concurrent access

Effort: S | Risk: Medium

**Option B: SQLite database**

Use SQLite for structured storage with indexes and queries.

Pros:
- Full query capability
- ACID transactions
- Excellent performance for complex queries

Cons:
- Binary format (not human-readable, not diffable)
- Adds implicit dependency on SQLite bindings
- Over-engineered for simple key-value observations
- Potential platform compatibility issues in VS Code extension host

Effort: L | Risk: Medium

**Option C: JSON Lines (JSONL) (SELECTED)**

One JSON object per line. Append-only writes. File locking for concurrent access.

Pros:
- Append-only writes are fast and crash-safe (partial write loses one entry, not all)
- Human-readable and greppable
- No external dependencies
- Streaming reads for large files
- Compatible with existing AgentX file-based state patterns

Cons:
- No built-in indexing (must scan for queries)
- TTL-based pruning requires rewrite of entire file
- Not suitable for complex relational queries

Effort: S | Risk: Low

#### Rationale

We chose **Option C** because:

1. **Consistency**: AgentX already uses JSON files for state (agent-status.json, clarification ledgers, loop-state.json). JSONL is a natural extension.
2. **Crash Safety**: Append-only writes mean a crash mid-write loses at most one entry. A single JSON file or SQLite could corrupt the entire store.
3. **No Dependencies**: No native bindings or external packages. Standard Node.js fs module handles all operations.
4. **Sufficient Performance**: For the expected scale (hundreds to low thousands of observations), sequential scan with tag filtering is fast enough. If vector search is needed later, that is a separate future enhancement.

---

### ADR-47.5: Structured JSON Logging with File Rotation

#### Decision

We will implement **structured JSON logging** with newline-delimited JSON (JSONL) format, correlation IDs per loop iteration, and size-based file rotation (10 MB per file, 5 files retained, 50 MB total cap).

#### Options Considered

**Option A: Enhanced text logging (extend ThinkingLog)**

Add more structure to the existing text-based ThinkingLog output.

Pros:
- Minimal change
- ThinkingLog already works well for VS Code output channel

Cons:
- Text format not parseable by SIEM tools
- No correlation IDs for tracing
- No file rotation
- Not suitable for enterprise log aggregation

Effort: S | Risk: Medium

**Option B: Third-party logging library (winston, pino)**

Integrate a production logging library with built-in rotation and formatting.

Pros:
- Battle-tested
- Rich feature set
- Community support

Cons:
- Adds external dependency (contrary to constraints)
- May conflict with VS Code extension host sandbox
- Heavyweight for our needs

Effort: M | Risk: Medium

**Option C: Custom JSONL logger with rotation (SELECTED)**

Purpose-built structured logger writing JSONL files with size-based rotation, correlation IDs, and secret redaction integration.

Pros:
- No external dependencies
- Tailored to AgentX needs (correlation IDs per loop iteration, secret redaction)
- JSONL format compatible with standard log analysis tools
- Size-based rotation prevents unbounded disk usage
- Simple implementation (~200 lines)

Cons:
- Must implement rotation logic (straightforward but custom)
- Less feature-rich than winston/pino
- Must handle edge cases (concurrent writes, disk full)

Effort: M | Risk: Low

#### Rationale

We chose **Option C** because:

1. **Zero Dependencies**: The requirement explicitly prohibits new external npm dependencies. A custom logger avoids this constraint entirely.
2. **Secret Redaction Integration**: The logger integrates directly with SecretRedactor at the write boundary, ensuring no credential ever reaches disk. Third-party loggers would need wrapper layers.
3. **Correlation IDs**: Per-iteration correlation IDs are first-class -- generated at loop start, propagated through all tool calls, and included in every log entry. This is not a standard feature of generic loggers.
4. **Enterprise Compatibility**: JSONL output is parseable by ELK, Splunk, Datadog, Azure Monitor, and other SIEM tools without custom parsers.
5. **Bounded Disk Usage**: 10 MB * 5 files = 50 MB maximum. Rotation logic is simple (check file size before write, rename if over limit).

---

## Consequences (Cross-Cutting)

### Positive

- Defense-in-depth security model replaces the trivially-bypassed 4-entry denylist
- Credential leaks in logs are eliminated via SecretRedactor
- Users make informed decisions about risky commands with reversibility classification
- Agentic loop recovers from stalls via intelligent replanning
- Independent tool calls complete faster via parallel execution
- Transient LLM failures are silently recovered via retry with backoff
- Enterprise teams can integrate structured logs into their monitoring pipelines
- All new features are backward-compatible with existing configurations

### Negative

- More complex command validation increases maintenance surface
- Allowlist requires initial curation and ongoing updates for new tool commands
- Parallel tool execution adds concurrency complexity (mitigated by Promise.allSettled isolation)
- Structured logging adds disk I/O (mitigated by async writes and rotation)
- LLM replanning consumes additional tokens during stall recovery

### Neutral

- New VS Code settings namespace (agentx.security.*, agentx.reliability.*, agentx.logging.*)
- 8 new TypeScript modules added to the extension
- Testing surface increases proportionally with new modules
- ThinkingLog now filters all output through SecretRedactor (transparent change)

---

## Implementation

**Detailed technical specification**: [SPEC-47.md](../specs/SPEC-47.md)

**High-level implementation plan:**

1. **Phase 1 (Weeks 1-2)**: CommandValidator, SecretRedactor, ReversibilityClassifier -- integrate into toolEngine.ts and thinkingLog.ts. Add VS Code settings schema.
2. **Phase 2 (Weeks 3-4)**: ProgressTracker, ParallelToolExecutor, RetryWithBackoff, PathSandbox, StructuredLogger -- integrate into agenticLoop.ts and vscodeLmAdapter.ts.
3. **Phase 3 (Weeks 5-6)**: OnError hook, SSRF validator, codebase tools, parallel agents, persistent memory, prompting modes, timing utilities, hook priority, bounded messages.

**Key milestones:**

- Phase 1: P0 security gate -- allowlist + redaction + reversibility deployed and tested (Week 2)
- Phase 2: P1 reliability gate -- parallel execution + retry + progress tracking + logging deployed (Week 4)
- Phase 3: P2/P3 advanced capabilities -- all 17 stories complete (Week 6)

---

## References

### Internal

- [PRD-47.md](../prd/PRD-47.md) -- Product Requirements Document
- [SPEC-47.md](../specs/SPEC-47.md) -- Technical Specification
- [ARCH-AgentX.md](../architecture/ARCH-AgentX.md) -- Existing Architecture
- [toolEngine.ts](../../vscode-extension/src/agentic/toolEngine.ts) -- Existing tool execution engine (line ~299: current denylist)
- [agenticLoop.ts](../../vscode-extension/src/agentic/agenticLoop.ts) -- Existing agentic loop
- [thinkingLog.ts](../../vscode-extension/src/utils/thinkingLog.ts) -- Existing thinking log

### External

- OWASP Command Injection Prevention Cheat Sheet -- allowlist-over-denylist principle
- OWASP SSRF Prevention Cheat Sheet -- IP validation and DNS rebinding protection
- AWS Architecture Blog -- Exponential backoff with jitter pattern
- JSON Lines Specification (jsonlines.org) -- JSONL format standard

---

## Review History

| Date | Reviewer | Status | Notes |
|------|----------|--------|-------|
| 2026-03-03 | Solution Architect Agent | Accepted | Initial ADR covering 5 key architectural decisions for Epic #47 |

---

**Generated by AgentX Architect Agent**
**Author**: Solution Architect Agent
**Last Updated**: 2026-03-03
**Version**: 1.0
