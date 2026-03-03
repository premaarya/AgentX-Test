# PRD: Security Hardening and Agentic Loop Enhancements

**Epic**: #47
**Status**: Approved
**Author**: Product Manager Agent
**Date**: 2026-03-03
**Stakeholders**: Piyush Jain (Creator/Lead), AgentX Engineering Team
**Priority**: p0

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Target Users](#2-target-users)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Requirements](#4-requirements)
5. [User Stories & Features](#5-user-stories--features)
6. [User Flows](#6-user-flows)
7. [Dependencies & Constraints](#7-dependencies--constraints)
8. [Risks & Mitigations](#8-risks--mitigations)
9. [Timeline & Milestones](#9-timeline--milestones)
10. [Out of Scope](#10-out-of-scope)
11. [Open Questions](#11-open-questions)
12. [Appendix](#12-appendix)

---

## 1. Problem Statement

### What problem are we solving?

AgentX's agentic loop grants LLM-driven agents the ability to execute shell commands, read/write files, and interact with external services. The current security model relies on a short denylist of dangerous commands (4 entries in toolEngine.ts) and lacks depth-in-defense measures such as path sandboxing, secret redaction, SSRF protection, and structured audit logging. Additionally, the agentic loop executes tool calls sequentially, provides no progress tracking or stall detection, and has limited resilience to transient LLM failures. These gaps prevent AgentX from meeting production-grade security and reliability standards expected by enterprise engineering teams.

### Why is this important?

- **Security**: A denylist approach is trivially bypassed (e.g., encoding, aliasing, compound commands). Production-grade agentic systems require allowlist validation, path sandboxing, secret redaction, and SSRF protection as defense-in-depth layers.
- **Reliability**: Without retry logic, stall detection, or structured progress tracking, the agentic loop can silently fail, spin indefinitely, or lose context on transient errors.
- **Auditability**: Enterprise teams need structured JSON logs with correlation IDs, file rotation, and timing data for compliance and incident investigation.
- **Performance**: Sequential tool execution wastes time when the LLM returns multiple independent tool calls that could run concurrently.

### What happens if we don't solve this?

- Agents can be tricked into executing dangerous commands via prompt injection or indirect attacks that evade the trivial denylist.
- Secrets (API keys, tokens, credentials) may leak into logs visible to users or stored on disk.
- The agentic loop hangs on transient LLM outages with no recovery path.
- Enterprise adoption is blocked due to insufficient security posture and lack of audit trails.
- Developer trust erodes when agents appear "stuck" with no visibility into progress.

---

## 2. Target Users

### Primary Users

**User Persona 1: AI Agent Developer**
- **Demographics**: Software engineers building and configuring multi-agent workflows in VS Code
- **Goals**: Build reliable agent pipelines that safely execute tools, recover from errors, and complete tasks autonomously
- **Pain Points**: Current denylist security is insufficient; no visibility into loop progress; sequential tool execution is slow; no retry on transient failures
- **Behaviors**: Configures agent definitions, writes custom tools, monitors agentic loop output in VS Code panels

**User Persona 2: Enterprise Engineering Team Lead**
- **Demographics**: Technical leads managing teams of 3-20 engineers in regulated or security-conscious organizations
- **Goals**: Deploy AgentX in team environments with confidence that security, auditability, and reliability meet organizational standards
- **Pain Points**: Cannot approve AI tooling without allowlist command controls, secret redaction, structured audit logs, and path sandboxing; needs compliance evidence
- **Behaviors**: Reviews security architecture; requires JSON-structured logs for SIEM integration; mandates defense-in-depth

**User Persona 3: Solo Developer**
- **Demographics**: Individual developers using AgentX for personal or freelance projects
- **Goals**: Safe, reliable AI-assisted coding without worrying about accidental destructive commands or leaked secrets
- **Pain Points**: Concerned that AI agents might delete files, expose credentials, or get stuck in infinite loops
- **Behaviors**: Uses default configurations; relies on sensible defaults for security; wants clear feedback when something goes wrong

### Secondary Users

- **DevOps engineers** who need structured logs for monitoring and alerting pipelines
- **Security auditors** who evaluate the tool's command execution and data handling practices
- **Open-source contributors** who extend AgentX with custom tools and need clear security integration patterns

---

## 3. Goals & Success Metrics

### Business Goals

1. **Security Posture**: Elevate command execution security from a 4-entry denylist to a comprehensive allowlist + sandboxing + redaction defense-in-depth model
2. **Reliability**: Achieve zero silent failures in the agentic loop through retry logic, stall detection, and structured progress tracking
3. **Enterprise Readiness**: Provide structured logging with JSON output and file rotation that integrates with standard monitoring/SIEM tools
4. **Performance**: Reduce agentic loop latency by executing independent tool calls in parallel

### Success Metrics (KPIs)

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Blocked dangerous command patterns | 4 denylist entries | Allowlist with compound analysis | Phase 1 |
| Secret patterns detected in logs | 0 (no redaction) | 100% of known patterns redacted | Phase 1 |
| Path traversal attacks blocked | 0 (no sandboxing) | All sensitive paths blocked | Phase 2 |
| Tool execution throughput (parallel) | 1x (sequential) | Up to Nx for N independent calls | Phase 2 |
| Stall detection and recovery | None | Auto-replan after 3 stalls | Phase 2 |
| Structured log coverage | 0% | 100% of agentic events | Phase 2 |
| LLM retry success on transient errors | 0% (crash) | 90%+ recovery | Phase 2 |
| Unit test coverage on new modules | N/A | >= 80% | All Phases |

### User Success Criteria

- An agent attempting to run an unknown command is prompted for confirmation with a reversibility classification (easy/effort/irreversible) and undo hint
- API keys and tokens never appear in user-visible log output or persisted log files
- The agentic loop automatically retries on transient LLM failures and replans when stalled
- Enterprise users can point their SIEM at JSON log files with correlation IDs for full audit trails
- Parallel tool execution is transparent to agents -- no behavioral changes, only faster completion

---

## 4. Requirements

### 4.1 Functional Requirements

#### Must Have (P0)

1. **Allowlist-based Command Security**
   - Replace the current denylist in toolEngine.ts (line ~299) with an allowlist-based validation system
   - Only commands matching the allowlist auto-execute; all unknown commands require user confirmation
   - Parse compound commands (splitting on `;`, `&&`, `||`, `|`) and validate each sub-command independently
   - Maintain a configurable allowlist that users can extend via VS Code settings
   - **User Story**: As an enterprise team lead, I want only known-safe commands to auto-execute so that prompt injection or accidental dangerous commands are blocked by default
   - **Acceptance Criteria**:
     - [ ] Allowlist loaded from configuration at engine initialization
     - [ ] Compound commands split and each sub-command validated independently
     - [ ] Unknown commands trigger confirmation dialog with command details
     - [ ] Allowlist is extensible via `agentx.security.commandAllowlist` VS Code setting
     - [ ] All 4 existing denylist patterns remain blocked (defense in depth)
     - [ ] Unit tests cover: allowlisted command passes, unknown command prompts, compound splitting, denylist override

2. **Secret Redaction in Logs**
   - Create a `secretRedactor.ts` utility that strips known credential patterns from any string
   - Patterns: Bearer tokens, `sk-*`, `ghp_*`, `gho_*`, `github_pat_*`, AWS access keys (`AKIA*`), Azure connection strings, generic `password=`, `secret=`, `token=`, and base64-encoded JWT segments
   - Integrate with ThinkingLog and any future structured logger
   - **User Story**: As a developer, I want my API keys and tokens automatically stripped from log output so that credentials are never exposed in visible panels or log files
   - **Acceptance Criteria**:
     - [ ] Regex-based redaction covers all listed patterns
     - [ ] Replacement text is `[REDACTED]` with pattern type hint (e.g., `[REDACTED:bearer]`)
     - [ ] Redactor is idempotent (double-redaction produces same output)
     - [ ] Integrated with ThinkingLog output before display/persistence
     - [ ] Unit tests with sample strings containing each credential pattern
     - [ ] No false positives on common English words or code identifiers

3. **Action Reversibility Classification**
   - When a command requires confirmation (not in allowlist), classify its reversibility
   - Categories: `easy` (undo available, e.g., git stash, git checkout), `effort` (manual restore needed, e.g., file overwrite with no backup), `irreversible` (cannot undo, e.g., rm -rf, DROP TABLE)
   - Display the classification and undo hint in the confirmation dialog
   - **User Story**: As a solo developer, I want to see how risky a command is and how to undo it before I approve it so that I make informed decisions about agent actions
   - **Acceptance Criteria**:
     - [ ] Classification engine maps command patterns to reversibility categories
     - [ ] `easy` commands show specific undo hint (e.g., "Undo: git stash pop")
     - [ ] `effort` commands show warning and general recovery guidance
     - [ ] `irreversible` commands show strong warning with red indicator
     - [ ] Classification displayed in VS Code confirmation dialog
     - [ ] Classification logic is extensible (new patterns can be added)
     - [ ] Unit tests cover all three categories with representative commands

#### Should Have (P1)

4. **Dual-Ledger Progress Tracking**
   - Implement `TaskLedger` (objective, facts, assumptions, plan) and `ProgressLedger` (current step index, step history, stall count, last progress timestamp)
   - Stall detection: 3 consecutive failed steps trigger replan (regenerate plan from TaskLedger)
   - Time-based stale detection: 60 seconds without progress update triggers a warning event
   - Expose ledger state via ThinkingLog events for UI visibility
   - **User Story**: As an agent developer, I want to see what step the agent is on and whether it is making progress so that I can intervene early if something goes wrong
   - **Acceptance Criteria**:
     - [ ] TaskLedger stores objective, facts[], assumptions[], plan[]
     - [ ] ProgressLedger tracks currentStep, stepHistory[], stallCount, lastProgressTimestamp
     - [ ] After 3 consecutive failures, loop triggers replan using TaskLedger context
     - [ ] After 60s without progress, a stale warning event is emitted
     - [ ] Ledger state visible in ThinkingLog output
     - [ ] Unit tests for stall detection, replan trigger, and stale timeout

5. **Parallel Tool Execution**
   - When the LLM returns multiple tool calls in a single response, identify independent calls (no data dependencies)
   - Execute independent calls via `Promise.allSettled()` instead of sequential awaits
   - Collect results in original order and append to conversation
   - Fall back to sequential execution if any call depends on a previous call's output
   - **User Story**: As an agent developer, I want independent tool calls to execute in parallel so that multi-tool responses complete faster
   - **Acceptance Criteria**:
     - [ ] Multiple tool calls in a single LLM response execute concurrently when independent
     - [ ] Results are collected in original order regardless of completion order
     - [ ] `Promise.allSettled()` used so one failure does not cancel others
     - [ ] Sequential fallback when dependency detected
     - [ ] Performance improvement measurable (log elapsed time for parallel vs. sequential)
     - [ ] Unit tests with mock tools verifying parallel execution and result ordering

6. **Path Sandboxing**
   - Extend toolEngine.ts to validate file paths before read/write/execute operations
   - Block access to sensitive directories: `.ssh/`, `.aws/`, `.gnupg/`, `.azure/`, `.kube/`
   - Block access to sensitive file patterns: `.env`, `*.pem`, `*.key`, `*password*`, `*secret*`, `*.pfx`, `*.p12`
   - Configurable workspace-root-relative sandbox boundary
   - **User Story**: As an enterprise team lead, I want file access restricted to the workspace and away from credential stores so that agents cannot exfiltrate sensitive files
   - **Acceptance Criteria**:
     - [ ] Path validation runs before any file read/write/execute tool
     - [ ] Blocked directory list is configurable via `agentx.security.blockedPaths` setting
     - [ ] Blocked file patterns configurable via `agentx.security.blockedFilePatterns` setting
     - [ ] Path traversal attempts (e.g., `../../.ssh/id_rsa`) detected and blocked
     - [ ] Clear error message returned to the LLM explaining why access was denied
     - [ ] Unit tests for directory blocking, pattern blocking, traversal detection

7. **LLM Retry with Exponential Backoff**
   - Add retry logic to the LlmAdapter layer (vscodeLmAdapter.ts) for transient failures
   - Retry on: HTTP 429 (rate limit), 500/502/503 (server errors), network timeouts
   - Exponential backoff: base 1s, multiplier 2x, max 32s, jitter +/- 20%
   - Maximum 5 retries before propagating the error
   - **User Story**: As an agent developer, I want the agentic loop to automatically retry on transient LLM errors so that temporary outages do not crash the entire workflow
   - **Acceptance Criteria**:
     - [ ] Retry logic wraps LLM API calls in the adapter layer
     - [ ] Retries on 429, 500, 502, 503, and network timeout errors
     - [ ] Exponential backoff with jitter (1s, 2s, 4s, 8s, 16s, 32s cap)
     - [ ] Maximum 5 retries before throwing
     - [ ] Retry attempts logged with attempt number, delay, and error type
     - [ ] Non-transient errors (400, 401, 403) are NOT retried
     - [ ] Unit tests for retry count, backoff timing, jitter range, non-retriable errors

8. **Structured Logging with File Rotation**
   - Create a `structuredLogger.ts` utility with JSON-formatted log entries
   - Fields: timestamp (ISO 8601), level (debug/info/warn/error), correlationId, agentName, toolName, message, durationMs, metadata
   - File rotation: 10 MB max per file, 5 rotated files kept
   - Output to `.agentx/logs/` directory
   - Integrate secret redaction (from P0 feature) on all log entries
   - **User Story**: As a DevOps engineer, I want JSON-structured log files with rotation so that I can integrate AgentX logs into our monitoring and alerting pipeline
   - **Acceptance Criteria**:
     - [ ] Log entries are valid JSON with all specified fields
     - [ ] Correlation ID propagated across related log entries within a loop iteration
     - [ ] File rotation at 10 MB boundary with 5 file retention
     - [ ] Logs written to `.agentx/logs/agentx-{date}.json`
     - [ ] Secret redaction applied to all log entry string fields
     - [ ] Performance timing utility (`time()` wrapper) integrated
     - [ ] Unit tests for JSON format, rotation trigger, correlation ID propagation

#### Could Have (P2)

9. **OnError Hook with Retry/Fallback**
   - Add `onError` to the `AgenticLoopHooks` interface alongside existing `onToolCall`, `onMessage` hooks
   - Hook receives error context (tool name, error, attempt count) and returns a strategy: `retry`, `fallback` (with replacement result), or `abort`
   - Default behavior (no hook registered): abort on error (current behavior preserved)
   - **User Story**: As an agent developer, I want to register error handlers that can retry or provide fallback results so that non-critical tool failures do not crash the loop
   - **Acceptance Criteria**:
     - [ ] `onError` hook added to AgenticLoopHooks interface
     - [ ] Hook receives { toolName, error, attemptCount, context }
     - [ ] Hook can return { strategy: 'retry' | 'fallback' | 'abort', fallbackResult? }
     - [ ] Default behavior is abort (backward compatible)
     - [ ] Maximum 3 retries per tool call via onError
     - [ ] Unit tests for retry, fallback, and abort strategies

10. **Codebase Analysis Tools**
    - `analyze_codebase`: File counts by extension, lines of code, technology stack detection (package.json, requirements.txt, *.csproj), repo size
    - `find_dependencies`: Parse package.json/requirements.txt/*.csproj and list direct dependencies with versions
    - `map_architecture`: Identify entry points, config files, test directories, CI/CD files, and output a structural summary
    - **User Story**: As an AI agent, I want tools to understand the codebase structure and dependencies so that I can make informed decisions about implementations
    - **Acceptance Criteria**:
      - [ ] `analyze_codebase` returns file counts, LOC, detected technologies
      - [ ] `find_dependencies` parses at least 3 package formats
      - [ ] `map_architecture` identifies entry points, configs, tests, CI files
      - [ ] All tools registered in ToolRegistry with proper schemas
      - [ ] Results are structured (JSON-formatted ToolResult)
      - [ ] Unit tests with mock project structures

11. **SSRF Protection**
    - Validate URLs before any HTTP request tool execution
    - Block private IP ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8
    - Block cloud metadata endpoints: 169.254.169.254, fd00::/8
    - Block `file://` protocol and other non-HTTP(S) schemes
    - DNS resolution check to catch DNS rebinding (resolve before request, validate IP)
    - **User Story**: As an enterprise team lead, I want outbound HTTP requests validated against SSRF attacks so that agents cannot be tricked into accessing internal infrastructure
    - **Acceptance Criteria**:
      - [ ] Private IP ranges blocked with clear error message
      - [ ] Cloud metadata endpoint (169.254.169.254) blocked
      - [ ] file://, ftp://, gopher:// schemes blocked
      - [ ] DNS resolution performed before request, resolved IP validated
      - [ ] Configurable allowlist for internal URLs that should be permitted
      - [ ] Unit tests for each blocked range, scheme, and DNS rebinding scenario

12. **Parallel Agent Executor**
    - Enable multiple sub-agents to run concurrently from subAgentSpawner.ts
    - Strategies: `all` (wait for all, merge results), `race` (first success wins), `quorum` (majority must agree)
    - Consolidation methods: `merge` (combine all outputs), `vote` (majority answer), `best` (highest confidence)
    - Timeout per sub-agent with graceful cancellation
    - **User Story**: As an agent developer, I want to run multiple sub-agents in parallel with configurable strategies so that complex tasks can be decomposed and executed concurrently
    - **Acceptance Criteria**:
      - [ ] `runParallel()` method added to SubAgentSpawner
      - [ ] Supports all, race, and quorum strategies
      - [ ] Supports merge, vote, and best consolidation methods
      - [ ] Per-agent timeout with cancellation token
      - [ ] Results consolidated according to selected method
      - [ ] Unit tests for each strategy and consolidation combination

13. **Persistent Cross-Session Memory**
    - Create a lightweight memory store using JSON/JSONL files in `.agentx/memory/`
    - Operations: store(key, value, tags[]), recall(query), forget(key)
    - Tag-based recall for filtering observations
    - Automatic expiry: entries older than configurable TTL (default 30 days) are pruned on load
    - **User Story**: As an AI agent, I want to remember facts and observations across sessions so that I do not repeat analysis or lose context between conversations
    - **Acceptance Criteria**:
      - [ ] Memory stored in `.agentx/memory/observations.jsonl`
      - [ ] store(), recall(), forget() operations functional
      - [ ] Tag-based filtering on recall
      - [ ] TTL-based automatic pruning
      - [ ] File locking for concurrent access safety
      - [ ] Unit tests for CRUD operations, tag filtering, and TTL expiry

#### Won't Have (Out of Scope)

- GUI-based security policy editor (future epic)
- Custom LLM provider plugin system (existing adapter is sufficient)
- Real-time collaborative multi-user agent sessions
- Cloud-hosted log aggregation service (users integrate with their own SIEM)

### 4.2 Non-Functional Requirements

#### Performance

- **Parallel Tool Execution**: Independent tool calls must execute concurrently with no serialization overhead
- **Retry Latency**: Exponential backoff must not exceed 32 seconds per retry; total retry sequence under 2 minutes
- **Logging Throughput**: Structured logger must handle 1000+ log entries per second without blocking the agentic loop
- **Secret Redaction**: Redaction must complete in under 1ms per log entry (regex pre-compiled)

#### Security

- **Defense in Depth**: Allowlist + denylist + path sandboxing + secret redaction + SSRF protection as layered defenses
- **Least Privilege**: Commands not in the allowlist require explicit user approval
- **No Secret Persistence**: Redacted secrets must never be written to disk in any form
- **Path Isolation**: Workspace sandbox prevents access to credential stores outside the project

#### Scalability

- **Log Rotation**: 10 MB per file x 5 files = 50 MB maximum disk usage for logs
- **Memory Store**: JSONL format supports append-only writes for efficient large stores
- **Parallel Agents**: Sub-agent executor supports up to 10 concurrent agents

#### Reliability

- **LLM Retry**: 5 retries with exponential backoff for transient failures
- **Stall Detection**: 3 consecutive failures trigger automatic replanning
- **Stale Detection**: 60-second timeout emits warning event for monitoring
- **Graceful Degradation**: If structured logger fails, fall back to console output

---

## 5. User Stories & Features

### Feature 1: Security Hardening

**Description**: Comprehensive security improvements to the tool execution engine including allowlist-based command validation, secret redaction, action reversibility classification, path sandboxing, and SSRF protection.
**Priority**: P0-P2 (layered delivery)
**Epic**: #47

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-1.1 | enterprise team lead | an allowlist-based command validation system | only known-safe commands auto-execute and unknown commands require my approval | - [ ] Allowlist loaded from config<br>- [ ] Compound command splitting on ; && \|\| \|<br>- [ ] Unknown commands prompt for confirmation<br>- [ ] Extensible via VS Code settings<br>- [ ] Existing denylist retained as fallback<br>- [ ] 80%+ test coverage | P0 | 4 days |
| US-1.2 | developer | automatic secret redaction in all log output | my API keys and tokens are never exposed in visible panels or log files | - [ ] Regex patterns for Bearer, sk-, ghp_, gho_, github_pat_, AKIA, connection strings, password=, secret=, token=<br>- [ ] [REDACTED:type] replacement<br>- [ ] Idempotent redaction<br>- [ ] Integrated with ThinkingLog<br>- [ ] 80%+ test coverage | P0 | 3 days |
| US-1.3 | solo developer | to see how risky a command is before approving it | I make informed decisions about agent actions | - [ ] easy/effort/irreversible classification<br>- [ ] Undo hints for easy commands<br>- [ ] Warning levels for effort and irreversible<br>- [ ] Displayed in confirmation dialog<br>- [ ] Extensible pattern registry<br>- [ ] 80%+ test coverage | P0 | 3 days |
| US-1.4 | enterprise team lead | file access restricted to the workspace and away from credential stores | agents cannot exfiltrate sensitive files from my system | - [ ] Blocked directories (.ssh, .aws, .gnupg, .azure, .kube)<br>- [ ] Blocked file patterns (.env, *.pem, *.key)<br>- [ ] Path traversal detection<br>- [ ] Configurable via VS Code settings<br>- [ ] Clear error messages to LLM<br>- [ ] 80%+ test coverage | P1 | 3 days |
| US-1.5 | enterprise team lead | outbound HTTP requests validated against SSRF attacks | agents cannot access internal infrastructure or cloud metadata | - [ ] Private IP ranges blocked<br>- [ ] Cloud metadata endpoint blocked<br>- [ ] Non-HTTP schemes blocked<br>- [ ] DNS resolution validation<br>- [ ] Configurable internal URL allowlist<br>- [ ] 80%+ test coverage | P2 | 3 days |

### Feature 2: Agentic Loop Enhancements

**Description**: Improvements to the core agentic loop including dual-ledger progress tracking, parallel tool execution, LLM retry with backoff, error hooks, and bounded message arrays.
**Priority**: P1-P3 (incremental delivery)
**Epic**: #47

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-2.1 | agent developer | dual-ledger progress tracking (TaskLedger + ProgressLedger) | I can see what step the agent is on and whether it is making progress | - [ ] TaskLedger with objective, facts, assumptions, plan<br>- [ ] ProgressLedger with currentStep, stepHistory, stallCount<br>- [ ] Replan after 3 consecutive failures<br>- [ ] Stale warning after 60s<br>- [ ] Visible in ThinkingLog<br>- [ ] 80%+ test coverage | P1 | 5 days |
| US-2.2 | agent developer | independent tool calls to execute in parallel | multi-tool responses complete faster | - [ ] Concurrent execution via Promise.allSettled<br>- [ ] Results in original order<br>- [ ] One failure does not cancel others<br>- [ ] Sequential fallback for dependent calls<br>- [ ] Elapsed time logged<br>- [ ] 80%+ test coverage | P1 | 4 days |
| US-2.3 | agent developer | automatic retry on transient LLM errors with exponential backoff | temporary outages do not crash the workflow | - [ ] Retry on 429, 500, 502, 503, network timeout<br>- [ ] Exponential backoff 1s-32s with jitter<br>- [ ] Max 5 retries<br>- [ ] Non-transient errors not retried<br>- [ ] Retry attempts logged<br>- [ ] 80%+ test coverage | P1 | 3 days |
| US-2.4 | agent developer | an onError hook for retry/fallback strategies | non-critical tool failures do not crash the loop | - [ ] onError added to AgenticLoopHooks<br>- [ ] Returns retry/fallback/abort strategy<br>- [ ] Default is abort (backward compatible)<br>- [ ] Max 3 retries per tool call<br>- [ ] 80%+ test coverage | P2 | 3 days |
| US-2.5 | agent developer | a hard cap on conversation messages | runaway conversations cannot exhaust memory | - [ ] Configurable max message count (default 200)<br>- [ ] Oldest non-system messages pruned when cap reached<br>- [ ] Works alongside token-based compaction<br>- [ ] Warning emitted before pruning<br>- [ ] 80%+ test coverage | P3 | 2 days |

### Feature 3: Observability and Logging

**Description**: Structured logging with JSON output, file rotation, correlation IDs, performance timing, and integration with secret redaction.
**Priority**: P1-P3 (foundation then enhancements)
**Epic**: #47

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-3.1 | DevOps engineer | JSON-structured log files with rotation | I can integrate AgentX logs into our monitoring pipeline | - [ ] Valid JSON with timestamp, level, correlationId, agentName, toolName, message, durationMs, metadata<br>- [ ] File rotation at 10 MB / 5 files<br>- [ ] Logs in .agentx/logs/<br>- [ ] Secret redaction integrated<br>- [ ] 80%+ test coverage | P1 | 4 days |
| US-3.2 | agent developer | time() and timeSync() performance utilities | I can measure and optimize operation durations | - [ ] time() wraps async functions, returns result + durationMs<br>- [ ] timeSync() wraps sync functions<br>- [ ] Results logged to ThinkingLog<br>- [ ] Integrates with structured logger<br>- [ ] 80%+ test coverage | P3 | 2 days |

### Feature 4: Advanced Agent Capabilities

**Description**: Higher-level capabilities including codebase analysis tools, parallel agent execution, persistent memory, prompting modes, and hook priority ordering.
**Priority**: P2-P3 (future-looking)
**Epic**: #47

| Story ID | As a... | I want... | So that... | Acceptance Criteria | Priority | Estimate |
|----------|---------|-----------|------------|---------------------|----------|----------|
| US-4.1 | AI agent | tools to understand codebase structure and dependencies | I make informed decisions about implementations | - [ ] analyze_codebase: file counts, LOC, tech detection<br>- [ ] find_dependencies: parse 3+ package formats<br>- [ ] map_architecture: entry points, configs, tests, CI<br>- [ ] Registered in ToolRegistry<br>- [ ] JSON-structured results<br>- [ ] 80%+ test coverage | P2 | 4 days |
| US-4.2 | agent developer | multiple sub-agents running in parallel | complex tasks can be decomposed and executed concurrently | - [ ] runParallel() on SubAgentSpawner<br>- [ ] all/race/quorum strategies<br>- [ ] merge/vote/best consolidation<br>- [ ] Per-agent timeout + cancellation<br>- [ ] 80%+ test coverage | P2 | 5 days |
| US-4.3 | AI agent | persistent memory across sessions | I do not repeat analysis or lose context between conversations | - [ ] JSONL storage in .agentx/memory/<br>- [ ] store/recall/forget operations<br>- [ ] Tag-based filtering<br>- [ ] TTL-based pruning (30 days default)<br>- [ ] File locking<br>- [ ] 80%+ test coverage | P2 | 4 days |
| US-4.4 | agent developer | agents to operate in different prompting modes | I can switch behavior (write/refactor/test/docs) without creating new agent definitions | - [ ] Mode parameter on agent invocation<br>- [ ] Mode-specific system prompts loaded<br>- [ ] Default mode preserved (backward compatible)<br>- [ ] At least 4 built-in modes for Engineer agent<br>- [ ] 80%+ test coverage | P3 | 3 days |
| US-4.5 | agent developer | hooks to specify execution priority | I can control the order hooks fire in | - [ ] Priority field on hook registration (lower = earlier)<br>- [ ] Default priority = 100<br>- [ ] Hooks sorted by priority before execution<br>- [ ] Backward compatible (existing hooks get default priority)<br>- [ ] 80%+ test coverage | P3 | 2 days |

---

## 6. User Flows

### Primary Flow: Allowlist Command Validation

**Trigger**: LLM returns a tool call requesting shell command execution
**Preconditions**: Agentic loop is running; toolEngine.ts processes the tool call

**Steps**:
1. LLM returns a `run_command` tool call with a shell command string
2. Tool engine checks the command against the hard-coded denylist (existing defense layer)
3. If denylist match -> block immediately with error message (no change from current behavior)
4. Tool engine splits compound commands on `;`, `&&`, `||`, `|`
5. Each sub-command is checked against the allowlist
6. If ALL sub-commands are allowlisted -> execute immediately (auto-approve)
7. If ANY sub-command is NOT allowlisted -> classify reversibility (easy/effort/irreversible)
8. Show confirmation dialog with: command text, reversibility classification, undo hint
9. User approves -> execute command; User denies -> return denial to LLM
10. **Success State**: Command executes safely or user makes informed denial

**Alternative Flows**:
- **5a. Empty command**: Return error "Empty command" to LLM
- **8a. Irreversible command**: Confirmation dialog uses red warning indicator and requires explicit "I understand" checkbox
- **9a. Timeout (30s no response)**: Auto-deny and return timeout to LLM

### Secondary Flow: Stall Detection and Replan

**Trigger**: Agentic loop detects 3 consecutive tool call failures
**Preconditions**: Dual-ledger progress tracking is active; TaskLedger has a valid plan

**Steps**:
1. Tool call fails; ProgressLedger increments stallCount
2. stallCount reaches 3
3. Loop pauses tool execution
4. TaskLedger's current plan is sent back to LLM with context: "Plan stalled after 3 consecutive failures. Facts: [...], Last 3 errors: [...]. Please revise the plan."
5. LLM returns a revised plan
6. TaskLedger updated with new plan; ProgressLedger reset (stallCount = 0, new steps)
7. Loop resumes with revised plan
8. **Success State**: Agent recovers from stall and continues making progress

**Alternative Flows**:
- **5a. LLM fails during replan**: Retry with exponential backoff (P1 feature)
- **7a. Second stall (stallCount = 3 again after replan)**: Emit critical warning event; if configured, abort loop with summary of attempts

### Tertiary Flow: Secret Redaction in Logging Pipeline

**Trigger**: Any component writes a log entry or displays output in ThinkingLog
**Preconditions**: secretRedactor.ts is initialized

**Steps**:
1. Component generates a log message string
2. Before writing to output, the string is passed through `redactSecrets()`
3. Regex engine scans for all known credential patterns
4. Each match is replaced with `[REDACTED:type]` (e.g., `[REDACTED:bearer]`, `[REDACTED:aws-key]`)
5. Redacted string is passed to the output destination (ThinkingLog panel, structured log file)
6. **Success State**: Log entry is displayed/persisted with no credential exposure

---

## 7. Dependencies & Constraints

### Technical Dependencies

| Dependency | Type | Status | Owner | Impact if Unavailable |
|------------|------|--------|-------|----------------------|
| VS Code Extension API | External | Available | Microsoft | High - Extension cannot function |
| VS Code Language Model API | External | Available | Microsoft | High - LLM calls blocked |
| Node.js fs/path modules | Internal | Available | Node.js | High - File operations blocked |
| Existing ToolRegistry (toolEngine.ts) | Internal | Available | AgentX | High - Must extend, not replace |
| Existing AgenticLoop (agenticLoop.ts) | Internal | Available | AgentX | High - Must extend, not replace |
| Existing ThinkingLog (thinkingLog.ts) | Internal | Available | AgentX | Medium - Logging integration deferred |
| Existing SubAgentSpawner (subAgentSpawner.ts) | Internal | Available | AgentX | Medium - Parallel agents blocked |
| Existing ContextCompactor (contextCompactor.ts) | Internal | Available | AgentX | Low - Bounded messages is additive |

### Technical Constraints

- Must maintain backward compatibility with existing tool definitions and agent configurations
- Must use the existing VS Code extension activation model (no new extension host processes)
- All new modules must follow existing TypeScript patterns (readonly interfaces, pure functions where possible)
- Configuration must use standard VS Code settings API (`vscode.workspace.getConfiguration`)
- Log files must not exceed 50 MB total disk usage (10 MB x 5 rotation files)
- All code must be ASCII-only (no Unicode symbols or emoji)

### Resource Constraints

- Development: 1-2 engineers working iteratively with AI agents
- Timeline: 4-6 weeks across 3 phases
- No additional infrastructure or external service costs

---

## 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|------------|-------|
| Allowlist too restrictive at launch, blocking legitimate commands | High | High | Ship with a broad default allowlist; provide easy extension via VS Code settings; monitor user feedback | Engineer |
| Secret redaction regex has false positives on code identifiers | Medium | Medium | Test against real codebase output; add exclusion patterns for common false positives; make patterns configurable | Engineer |
| Parallel tool execution introduces race conditions | High | Medium | Use Promise.allSettled (not Promise.all); ensure tools have no shared mutable state; add integration tests | Engineer |
| LLM retry backoff causes perceived slowness | Medium | Low | Show retry status in ThinkingLog UI; allow user to cancel retries; configurable max retries | Engineer |
| Stall detection replans too aggressively | Medium | Medium | Configurable stall threshold (default 3); allow disabling replan; log replan reasoning | Engineer |
| Path sandboxing blocks legitimate cross-project file access | Medium | Medium | Configurable sandbox boundaries; workspace-relative by default; allowlist for specific paths | Engineer |
| Scope creep from 17 features | High | High | Strict phase-based delivery; P0 first; P3 only after P0-P1 shipped and validated | PM |

---

## 9. Timeline & Milestones

### Phase 1: Security Foundation (Weeks 1-2)

**Goal**: Deploy the three P0 security features that form the core defense-in-depth foundation.
**Deliverables**:
- Allowlist-based command security (US-1.1)
- Secret redaction utility (US-1.2)
- Action reversibility classification (US-1.3)
- Unit tests for all three features (>= 80% coverage)
- Updated VS Code settings schema for security configuration

**Stories**: US-1.1, US-1.2, US-1.3

### Phase 2: Reliability and Observability (Weeks 3-4)

**Goal**: Enhance the agentic loop with progress tracking, parallelism, retry logic, and structured logging.
**Deliverables**:
- Dual-ledger progress tracking (US-2.1)
- Parallel tool execution (US-2.2)
- LLM retry with exponential backoff (US-2.3)
- Path sandboxing (US-1.4)
- Structured logging with file rotation (US-3.1)
- Unit tests for all features (>= 80% coverage)

**Stories**: US-2.1, US-2.2, US-2.3, US-1.4, US-3.1

### Phase 3: Advanced Capabilities (Weeks 5-6)

**Goal**: Deliver P2/P3 features that extend the platform for advanced use cases.
**Deliverables**:
- OnError hook (US-2.4)
- SSRF protection (US-1.5)
- Codebase analysis tools (US-4.1)
- Parallel agent executor (US-4.2)
- Persistent cross-session memory (US-4.3)
- Prompting modes (US-4.4)
- Performance timing utility (US-3.2)
- Hook priority ordering (US-4.5)
- Bounded message array (US-2.5)
- Unit tests for all features (>= 80% coverage)

**Stories**: US-2.4, US-1.5, US-4.1, US-4.2, US-4.3, US-4.4, US-3.2, US-4.5, US-2.5

### Launch Criteria

**Target**: 2026-04-13
**Launch Criteria**:
- [ ] All P0 stories completed and tested
- [ ] All P1 stories completed and tested
- [ ] P2/P3 stories completed (best effort, may defer)
- [ ] Security audit passed (allowlist, sandboxing, redaction verified)
- [ ] Performance benchmarks met (parallel execution, logging throughput)
- [ ] Documentation updated (README, GUIDE.md, skill files)
- [ ] All unit tests passing with >= 80% coverage on new modules

---

## 10. Out of Scope

**Explicitly excluded from this Epic**:

- **GUI Security Policy Editor** - Visual editor for allowlist/blocklist management (future epic)
- **Cloud Log Aggregation** - Built-in integration with specific SIEM/monitoring platforms (users use their own)
- **Custom LLM Provider Plugins** - New adapter plugin system beyond existing vscodeLmAdapter (existing adapter sufficient)
- **Multi-User Collaborative Sessions** - Real-time collaborative agent sessions across users
- **AI/ML Model Training or Fine-Tuning** - This epic is infrastructure/tooling, not model development
- **Network-Level Security** - Firewall rules, VPN setup, or OS-level security hardening
- **Automated Penetration Testing** - Security testing of the extension itself (separate testing effort)

**Future Considerations**:

- **Security Dashboard** - Visual dashboard showing blocked commands, redacted secrets, and sandboxing events (revisit after Phase 2 telemetry is available)
- **Adaptive Allowlist** - ML-based allowlist that learns from user approval patterns (evaluate in Q3 2026)
- **Distributed Agent Execution** - Running sub-agents on remote machines or containers (evaluate after parallel executor proves out)
- **Memory Indexing** - Vector-based semantic search over persistent memory store (evaluate after JSONL store ships)

---

## 11. Open Questions

| Question | Owner | Status | Resolution |
|----------|-------|--------|------------|
| What should the default allowlist contain at launch? | Engineer | Open | Need to audit common Git, npm, dotnet, Python commands used by agents during typical workflows |
| Should path sandboxing allow access to node_modules/ by default? | Engineer | Open | Agents need to read package manifests; likely yes with read-only |
| Should stall replan use the same LLM or a fallback model? | Architect | Open | Using same model is simpler; fallback adds resilience but complexity |
| What is the right default TTL for persistent memory entries? | PM | Resolved | 30 days based on typical project sprint cycles |
| Should parallel tool execution be opt-in or opt-out? | Engineer | Open | Recommend opt-out (enabled by default) since Promise.allSettled is safe |
| What log level should be the default for structured logging? | DevOps | Open | Recommend "info" for production, "debug" for development |

---

## 12. Appendix

### Research and References

- OWASP Command Injection Prevention Cheat Sheet - allowlist-over-denylist principle
- OWASP SSRF Prevention Cheat Sheet - IP validation and DNS rebinding protection
- Industry best practices for agentic system security (defense-in-depth, least privilege)
- Exponential backoff with jitter - AWS Architecture Blog pattern
- Structured logging best practices (JSON Lines format, correlation IDs, file rotation)
- Dual-ledger progress tracking pattern for autonomous agent systems

### Glossary

- **Allowlist**: A list of explicitly permitted commands; anything not on the list is blocked or requires confirmation
- **Denylist**: A list of explicitly blocked commands; anything not on the list is permitted (current approach, less secure)
- **Compound Command**: A shell command containing multiple sub-commands joined by `;`, `&&`, `||`, or `|`
- **Reversibility Classification**: Categorization of a command's undoability: easy (quick undo), effort (manual restore), irreversible (cannot undo)
- **Secret Redaction**: The process of replacing sensitive credential patterns in text with placeholder tokens
- **SSRF**: Server-Side Request Forgery - an attack where an agent is tricked into making requests to internal/private endpoints
- **TaskLedger**: A data structure tracking the high-level objective, known facts, assumptions, and current plan
- **ProgressLedger**: A data structure tracking the current step, step history, stall count, and last progress timestamp
- **Stall Detection**: Identifying when an agent has failed 3 consecutive steps, indicating the current plan is not working
- **Exponential Backoff**: A retry strategy where the delay between retries doubles each time (1s, 2s, 4s, 8s...)
- **Jitter**: Random variation added to backoff delays to prevent thundering herd problems
- **Correlation ID**: A unique identifier propagated across related log entries for tracing a single operation
- **JSONL**: JSON Lines format - one JSON object per line, optimized for append-only writes and streaming reads

### Related Documents

- [Technical Specification](../specs/SPEC-47.md) (to be created by Architect)
- [Architecture Decision Record](../adr/ADR-47.md) (to be created by Architect)
- [Existing Architecture](../architecture/ARCH-AgentX.md)
- [Existing PRD](../prd/PRD-AgentX.md)

### File Impact Summary

| File | Change Type | Features Affected |
|------|------------|-------------------|
| `vscode-extension/src/agentic/toolEngine.ts` | Modify | US-1.1, US-1.3, US-1.4, US-4.1 |
| `vscode-extension/src/agentic/agenticLoop.ts` | Modify | US-2.1, US-2.2, US-2.5 |
| `vscode-extension/src/chat/vscodeLmAdapter.ts` | Modify | US-2.3 |
| `vscode-extension/src/agentic/subAgentSpawner.ts` | Modify | US-4.2 |
| `vscode-extension/src/utils/contextCompactor.ts` | Modify | US-2.5 |
| `vscode-extension/src/utils/thinkingLog.ts` | Modify | US-1.2, US-2.1, US-3.2 |
| `vscode-extension/src/utils/secretRedactor.ts` | Create | US-1.2 |
| `vscode-extension/src/utils/structuredLogger.ts` | Create | US-3.1 |
| `vscode-extension/src/agentic/progressLedger.ts` | Create | US-2.1 |
| `vscode-extension/src/agentic/ssrfValidator.ts` | Create | US-1.5 |
| `vscode-extension/src/agentic/codebaseAnalysis.ts` | Create | US-4.1 |
| `vscode-extension/src/memory/persistentStore.ts` | Create | US-4.3 |
| `vscode-extension/package.json` | Modify | US-1.1, US-1.4 (new settings) |

---

## Review & Approval

| Stakeholder | Role | Status | Date | Comments |
|-------------|------|--------|------|----------|
| Piyush Jain | Creator/Lead | Approved | 2026-03-03 | Internal project - auto-approved |
| Product Manager Agent | Product Manager | Approved | 2026-03-03 | PRD complete with 17 stories across 4 features |

---

**Generated by AgentX Product Manager Agent**
**Last Updated**: 2026-03-03
**Version**: 1.0
