# Technical Specification: Security Hardening and Agentic Loop Enhancements

**Issue**: #47
**Epic**: #47
**Status**: Draft
**Author**: Solution Architect Agent
**Date**: 2026-03-03
**Related ADR**: [ADR-47.md](../adr/ADR-47.md)

> **Acceptance Criteria**: Defined in the PRD user stories - see [PRD-47.md](../prd/PRD-47.md#5-user-stories--features). Engineers should track AC completion against the originating Story issue.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagrams](#2-architecture-diagrams)
3. [API Design](#3-api-design)
4. [Data Model Diagrams](#4-data-model-diagrams)
5. [Service Layer Diagrams](#5-service-layer-diagrams)
6. [Security Diagrams](#6-security-diagrams)
7. [Performance](#7-performance)
8. [Testing Strategy](#8-testing-strategy)
9. [Implementation Notes](#9-implementation-notes)
10. [Rollout Plan](#10-rollout-plan)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Monitoring & Observability](#12-monitoring--observability)

---

## 1. Overview

This specification details the technical design for Epic #47: Security Hardening and Agentic Loop Enhancements. The work replaces the existing 4-entry command denylist with a comprehensive defense-in-depth security model (allowlist validation, secret redaction, reversibility classification, path sandboxing) and extends the agentic loop with dual-ledger progress tracking, parallel tool execution, LLM retry with backoff, and structured JSON logging.

**Scope:**

- In scope: 17 user stories across 4 features -- allowlist command security, secret redaction, action reversibility, path sandboxing, dual-ledger progress tracking, parallel tool execution, LLM retry, structured logging, onError hook, codebase tools, SSRF protection, parallel agents, persistent memory, prompting modes, timing utilities, hook priority, bounded messages
- Out of scope: GUI security policy editor, cloud log aggregation, custom LLM provider plugins, multi-user collaborative sessions, network-level security

**Success Criteria:**

- Allowlist-based command validation with compound command splitting replaces the 4-entry denylist
- 100% of known credential patterns redacted from all log output
- Independent tool calls execute concurrently via Promise.allSettled
- Structured JSON logs with correlation IDs and 10 MB / 5-file rotation
- All new modules achieve >= 80% unit test coverage
- Zero breaking changes to existing tool definitions and agent configurations

---

## 2. Architecture Diagrams

### 2.1 High-Level System Architecture

The following diagram shows how the new security and reliability layers integrate into the existing AgentX extension architecture. New components are highlighted.

```mermaid
graph TD
    subgraph VSCode["VS Code Extension Host"]
        subgraph Chat["Chat Layer"]
            CP["chatParticipant.ts"]
            ACH["agenticChatHandler.ts"]
            VLA["vscodeLmAdapter.ts"]
        end

        subgraph Agentic["Agentic Loop Layer"]
            AL["agenticLoop.ts"]
            TE["toolEngine.ts"]
            SAS["subAgentSpawner.ts"]
            SRL["selfReviewLoop.ts"]
            TLD["toolLoopDetection.ts"]
        end

        subgraph SecurityNew["Security Layer (NEW)"]
            CV["CommandValidator"]
            SR["SecretRedactor"]
            RC["ReversibilityClassifier"]
            PS["PathSandbox"]
            SSRF["SsrfValidator"]
        end

        subgraph ReliabilityNew["Reliability Layer (NEW)"]
            PL["ProgressLedger"]
            PTE["ParallelToolExecutor"]
            RB["RetryWithBackoff"]
        end

        subgraph ObservabilityNew["Observability Layer (NEW)"]
            SL["StructuredLogger"]
            TL["ThinkingLog (extended)"]
        end

        subgraph State["State Layer"]
            SS["sessionState.ts"]
            CC["contextCompactor.ts"]
            EB["eventBus.ts"]
        end
    end

    subgraph External["External Systems"]
        LLM["LLM Provider"]
        FS["File System"]
        TERM["Terminal / Shell"]
    end

    CP --> ACH --> AL
    AL --> TE
    AL --> PL
    AL --> PTE
    TE --> CV --> RC
    TE --> PS
    TE --> SSRF
    VLA --> RB --> LLM
    AL --> SAS
    TE --> TERM
    TE --> FS
    AL --> SS
    AL --> CC
    SL --> SR
    TL --> SR
    EB --> TL
    EB --> SL

    style SecurityNew fill:#FFEBEE,stroke:#C62828
    style ReliabilityNew fill:#E8F5E9,stroke:#2E7D32
    style ObservabilityNew fill:#E3F2FD,stroke:#1565C0
```

**Component Responsibilities:**

| Layer | Responsibility | New/Modified |
|-------|---------------|--------------|
| **Chat Layer** | User interaction, LLM adapter, model selection | Modified (vscodeLmAdapter.ts adds retry) |
| **Agentic Loop Layer** | LLM-tool execution cycle, loop detection, sub-agents | Modified (parallel execution, progress ledger) |
| **Security Layer** | Command validation, secret redaction, reversibility, sandboxing, SSRF | NEW |
| **Reliability Layer** | Progress tracking, parallel execution, retry logic | NEW |
| **Observability Layer** | Structured JSON logging, secret-safe output | NEW + Modified |
| **State Layer** | Session persistence, context compaction, event dispatch | Modified (bounded messages) |

---

### 2.2 Sequence Diagram: Command Execution with Allowlist Validation (US-1.1, US-1.3)

```mermaid
sequenceDiagram
    participant LLM as LLM Provider
    participant AL as AgenticLoop
    participant TE as ToolEngine
    participant CV as CommandValidator
    participant RC as ReversibilityClassifier
    participant UI as VS Code UI
    participant TERM as Terminal

    LLM->>AL: Response with tool_call (terminal_exec)
    AL->>TE: execute(terminal_exec, {command})

    rect rgb(255, 235, 238)
    Note over TE,CV: Phase 1 - Denylist Check (existing)
    TE->>CV: validateCommand(command)
    CV->>CV: Check hardcoded denylist
    alt Denylist match
        CV-->>TE: BLOCKED (dangerous command)
        TE-->>AL: ToolResult(error: blocked)
    end
    end

    rect rgb(232, 245, 233)
    Note over CV,RC: Phase 2 - Compound Splitting + Allowlist
    CV->>CV: splitCompoundCommand(command)
    CV->>CV: Check each sub-command against allowlist
    alt All sub-commands allowlisted
        CV-->>TE: APPROVED (auto-execute)
        TE->>TERM: exec(command)
        TERM-->>TE: stdout/stderr
        TE-->>AL: ToolResult(output)
    else Any sub-command NOT allowlisted
        CV->>RC: classifyReversibility(command)
        RC-->>CV: Classification + undo hint
        CV-->>TE: NEEDS_CONFIRMATION(classification)
        TE->>UI: showConfirmationDialog(command, classification, undoHint)
        alt User approves
            UI-->>TE: Approved
            TE->>TERM: exec(command)
            TERM-->>TE: stdout/stderr
            TE-->>AL: ToolResult(output)
        else User denies
            UI-->>TE: Denied
            TE-->>AL: ToolResult(error: user denied)
        else Timeout (30s)
            UI-->>TE: Timeout
            TE-->>AL: ToolResult(error: confirmation timeout)
        end
    end
    end

    AL->>LLM: Append tool result to conversation
```

---

### 2.3 Sequence Diagram: Secret Redaction Pipeline (US-1.2)

```mermaid
sequenceDiagram
    participant SRC as Any Component
    participant SR as SecretRedactor
    participant TL as ThinkingLog
    participant SL as StructuredLogger
    participant OUT as Output Channel
    participant DISK as Log File

    SRC->>TL: log(agent, kind, label, detail)
    TL->>SR: redactSecrets(detail)
    SR->>SR: Apply compiled regex patterns
    SR-->>TL: Redacted string
    TL->>OUT: appendLine(redacted)
    TL->>SL: emit(logEntry with redacted fields)
    SL->>SR: redactSecrets(all string fields)
    SR-->>SL: Double-safe redacted entry
    SL->>DISK: appendJSON(redacted entry)

    Note over SR: Patterns: Bearer, sk-*, ghp_*, gho_*,<br/>github_pat_*, AKIA*, connection strings,<br/>password=, secret=, token=, JWT segments
    Note over SR: Output: [REDACTED:bearer], [REDACTED:aws-key], etc.
    Note over SR: Property: idempotent (safe to double-apply)
```

---

### 2.4 Sequence Diagram: Dual-Ledger Progress Tracking with Stall Detection (US-2.1)

```mermaid
sequenceDiagram
    participant AL as AgenticLoop
    participant TK as TaskLedger
    participant PG as ProgressLedger
    participant LLM as LLM Provider
    participant TL as ThinkingLog

    AL->>TK: initialize(objective, facts, assumptions)
    AL->>PG: initialize(plan steps from LLM)

    loop Each Iteration
        AL->>PG: beginStep(stepIndex)
        AL->>LLM: chat(messages, tools)
        LLM-->>AL: Response (tool_calls or text)

        alt Tool call succeeds
            AL->>PG: recordSuccess(stepIndex, result)
            PG->>PG: Reset stallCount = 0
            PG->>TL: emit(progress update)
        else Tool call fails
            AL->>PG: recordFailure(stepIndex, error)
            PG->>PG: Increment stallCount

            alt stallCount >= 3
                Note over PG,LLM: STALL DETECTED - Trigger Replan
                PG->>TK: getRePlanContext()
                TK-->>PG: objective + facts + last 3 errors
                PG->>LLM: "Plan stalled. Revise plan."
                LLM-->>PG: Revised plan
                PG->>TK: updatePlan(revisedPlan)
                PG->>PG: Reset stallCount = 0
                PG->>TL: emit(replan event)
            end
        end

        alt No progress for 60 seconds
            PG->>TL: emit(stale warning)
        end
    end
```

---

### 2.5 Sequence Diagram: Parallel Tool Execution (US-2.2)

```mermaid
sequenceDiagram
    participant LLM as LLM Provider
    participant AL as AgenticLoop
    participant PTE as ParallelToolExecutor
    participant T1 as Tool A
    participant T2 as Tool B
    participant T3 as Tool C

    LLM->>AL: Response with 3 tool_calls
    AL->>PTE: analyzeAndExecute(toolCalls)
    PTE->>PTE: Detect dependencies between calls

    alt All calls independent
        Note over PTE,T3: Parallel execution via Promise.allSettled
        par Execute concurrently
            PTE->>T1: execute(paramsA)
            T1-->>PTE: ResultA
        and
            PTE->>T2: execute(paramsB)
            T2-->>PTE: ResultB
        and
            PTE->>T3: execute(paramsC)
            T3-->>PTE: ResultC (or error)
        end
        PTE->>PTE: Collect results in original order
        PTE-->>AL: [ResultA, ResultB, ResultC]
    else Dependencies detected
        Note over PTE,T3: Sequential fallback
        PTE->>T1: execute(paramsA)
        T1-->>PTE: ResultA
        PTE->>T2: execute(paramsB)
        T2-->>PTE: ResultB
        PTE->>T3: execute(paramsC)
        T3-->>PTE: ResultC
        PTE-->>AL: [ResultA, ResultB, ResultC]
    end

    AL->>LLM: Append all results to conversation
```

---

### 2.6 Sequence Diagram: LLM Retry with Exponential Backoff (US-2.3)

```mermaid
sequenceDiagram
    participant AL as AgenticLoop
    participant VLA as VsCodeLmAdapter
    participant RB as RetryWithBackoff
    participant LLM as LLM Provider
    participant TL as ThinkingLog

    AL->>VLA: chat(messages, tools, signal)
    VLA->>RB: withRetry(llmCall, config)

    loop Attempt 1..5
        RB->>LLM: API Call
        alt Success (200)
            LLM-->>RB: Response
            RB-->>VLA: Response
            VLA-->>AL: LlmResponse
        else Transient Error (429, 500, 502, 503, timeout)
            LLM-->>RB: Error
            RB->>TL: log(retry attempt N, delay, error type)
            RB->>RB: Calculate delay: base * 2^(attempt-1) +/- 20% jitter
            Note over RB: Delays: 1s, 2s, 4s, 8s, 16s (cap 32s)
            RB->>RB: Wait(delay)
        else Non-Transient Error (400, 401, 403)
            LLM-->>RB: Error
            RB-->>VLA: Throw (no retry)
            VLA-->>AL: Error
        end
    end

    Note over RB: After 5 retries: propagate error
    RB-->>VLA: Throw final error
    VLA-->>AL: Error
```

---

### 2.7 Class/Interface Diagram: Security Layer

```mermaid
classDiagram
    class CommandValidator {
        <<module>>
        -denylist: ReadonlyArray~string~
        -allowlist: ReadonlyArray~string~
        +loadAllowlist(config) void
        +validateCommand(command) ValidationResult
        +splitCompoundCommand(command) string[]
        -checkDenylist(cmd) boolean
        -checkAllowlist(cmd) boolean
    }

    class ValidationResult {
        <<interface>>
        +status: "approved" | "blocked" | "needs_confirmation"
        +command: string
        +subCommands: string[]
        +blockedReason?: string
        +classification?: ReversibilityResult
    }

    class ReversibilityClassifier {
        <<module>>
        -easyPatterns: ReadonlyArray~PatternRule~
        -effortPatterns: ReadonlyArray~PatternRule~
        -irreversiblePatterns: ReadonlyArray~PatternRule~
        +classify(command) ReversibilityResult
        +addPattern(category, pattern) void
    }

    class ReversibilityResult {
        <<interface>>
        +category: "easy" | "effort" | "irreversible"
        +undoHint?: string
        +warningLevel: "info" | "warning" | "danger"
    }

    class PatternRule {
        <<interface>>
        +pattern: RegExp
        +undoHint?: string
        +description: string
    }

    class SecretRedactor {
        <<module>>
        -compiledPatterns: ReadonlyArray~RedactionPattern~
        +redactSecrets(input) string
        +addPattern(pattern) void
    }

    class RedactionPattern {
        <<interface>>
        +regex: RegExp
        +type: string
        +replacement: string
    }

    class PathSandbox {
        <<module>>
        -blockedDirs: ReadonlyArray~string~
        -blockedPatterns: ReadonlyArray~string~
        -workspaceRoot: string
        +validatePath(inputPath) PathValidationResult
        +isTraversalAttempt(inputPath) boolean
    }

    class PathValidationResult {
        <<interface>>
        +allowed: boolean
        +resolvedPath: string
        +reason?: string
    }

    class SsrfValidator {
        <<module>>
        -blockedRanges: ReadonlyArray~CidrRange~
        -blockedSchemes: ReadonlyArray~string~
        +validateUrl(url) SsrfValidationResult
        +resolveAndValidate(url) Promise~SsrfValidationResult~
    }

    CommandValidator --> ReversibilityClassifier : uses
    CommandValidator --> ValidationResult : returns
    ReversibilityClassifier --> ReversibilityResult : returns
    ReversibilityClassifier --> PatternRule : uses
    SecretRedactor --> RedactionPattern : uses
    PathSandbox --> PathValidationResult : returns
```

---

### 2.8 Class/Interface Diagram: Reliability Layer

```mermaid
classDiagram
    class TaskLedger {
        <<interface>>
        +objective: string
        +facts: ReadonlyArray~string~
        +assumptions: ReadonlyArray~string~
        +plan: ReadonlyArray~PlanStep~
        +createdAt: string
        +updatedAt: string
    }

    class ProgressLedger {
        <<interface>>
        +currentStepIndex: number
        +stepHistory: ReadonlyArray~StepRecord~
        +stallCount: number
        +lastProgressTimestamp: number
        +totalReplans: number
    }

    class PlanStep {
        <<interface>>
        +index: number
        +description: string
        +status: "pending" | "active" | "done" | "failed"
    }

    class StepRecord {
        <<interface>>
        +stepIndex: number
        +status: "success" | "failure"
        +timestamp: number
        +detail?: string
        +durationMs: number
    }

    class ProgressTracker {
        <<module>>
        -taskLedger: TaskLedger
        -progressLedger: ProgressLedger
        -stallThreshold: number
        -staleTimeoutMs: number
        +initialize(objective, plan) void
        +recordSuccess(stepIndex, result) void
        +recordFailure(stepIndex, error) void
        +isStalled() boolean
        +isStale() boolean
        +getRePlanContext() RePlanContext
        +reset() void
    }

    class RePlanContext {
        <<interface>>
        +objective: string
        +facts: ReadonlyArray~string~
        +lastErrors: ReadonlyArray~string~
        +failedSteps: ReadonlyArray~StepRecord~
    }

    class ParallelToolExecutor {
        <<module>>
        +analyzeAndExecute(calls, registry, ctx) Promise~ToolResult[]~
        +detectDependencies(calls) DependencyGraph
        -executeParallel(calls, registry, ctx) Promise~ToolResult[]~
        -executeSequential(calls, registry, ctx) Promise~ToolResult[]~
    }

    class RetryConfig {
        <<interface>>
        +maxRetries: number
        +baseDelayMs: number
        +maxDelayMs: number
        +multiplier: number
        +jitterPercent: number
        +retryableStatuses: ReadonlyArray~number~
    }

    class RetryWithBackoff {
        <<module>>
        +withRetry~T~(fn, config, log) Promise~T~
        -calculateDelay(attempt, config) number
        -isRetryable(error, config) boolean
    }

    ProgressTracker --> TaskLedger : manages
    ProgressTracker --> ProgressLedger : manages
    ProgressTracker --> RePlanContext : produces
    TaskLedger --> PlanStep : contains
    ProgressLedger --> StepRecord : contains
    RetryWithBackoff --> RetryConfig : uses
```

---

### 2.9 Class/Interface Diagram: Observability Layer

```mermaid
classDiagram
    class StructuredLogger {
        <<module>>
        -logDir: string
        -maxFileSize: number
        -maxFiles: number
        -currentFile: string
        -redactor: SecretRedactor
        +log(entry) void
        +debug(agent, message, meta) void
        +info(agent, message, meta) void
        +warn(agent, message, meta) void
        +error(agent, message, meta) void
        -rotateIfNeeded() void
        -writeEntry(entry) void
    }

    class LogEntry {
        <<interface>>
        +timestamp: string
        +level: "debug" | "info" | "warn" | "error"
        +correlationId: string
        +agentName: string
        +toolName?: string
        +message: string
        +durationMs?: number
        +metadata?: Record~string, unknown~
    }

    class RotationConfig {
        <<interface>>
        +maxFileSizeBytes: number
        +maxFiles: number
        +logDir: string
        +filenamePattern: string
    }

    StructuredLogger --> LogEntry : writes
    StructuredLogger --> RotationConfig : uses
    StructuredLogger --> SecretRedactor : uses
```

---

### 2.10 Component Integration Map

This diagram shows how new components integrate with existing AgentX modules. Solid lines are direct dependencies; dashed lines are event-based integration.

```mermaid
graph TD
    subgraph Existing["Existing Components (Modified)"]
        TE["toolEngine.ts<br/>+CommandValidator integration<br/>+PathSandbox integration"]
        AL["agenticLoop.ts<br/>+ProgressTracker<br/>+ParallelToolExecutor"]
        VLA["vscodeLmAdapter.ts<br/>+RetryWithBackoff"]
        TL["thinkingLog.ts<br/>+SecretRedactor integration"]
        CC["contextCompactor.ts<br/>+bounded message pruning"]
        SAS["subAgentSpawner.ts<br/>+runParallel()"]
        PKG["package.json<br/>+security settings schema"]
    end

    subgraph New["New Components"]
        CV["commandValidator.ts"]
        SR["secretRedactor.ts"]
        RC["reversibilityClassifier.ts"]
        PSB["pathSandbox.ts"]
        SSRF["ssrfValidator.ts"]
        PT["progressTracker.ts"]
        PTE["parallelToolExecutor.ts"]
        RB["retryWithBackoff.ts"]
        SLG["structuredLogger.ts"]
        CBA["codebaseAnalysis.ts"]
        PM["persistentStore.ts"]
    end

    TE --> CV
    TE --> PSB
    TE --> RC
    CV -.->|config| PKG
    PSB -.->|config| PKG
    AL --> PT
    AL --> PTE
    VLA --> RB
    TL --> SR
    SLG --> SR
    TE --> SSRF
    SAS -.->|P2 parallel| PTE

    style Existing fill:#E3F2FD,stroke:#1565C0
    style New fill:#E8F5E9,stroke:#2E7D32
```

---

## 3. API Design

This section defines the internal TypeScript interfaces for the new modules. No REST/HTTP APIs are introduced -- all interfaces are extension-internal.

### 3.1 CommandValidator Interface

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| loadAllowlist | VS Code config | void | Load allowlist from settings at initialization |
| validateCommand | command: string | ValidationResult | Validate a shell command against denylist + allowlist |
| splitCompoundCommand | command: string | string[] | Split compound commands on ; && \|\| \| |

**ValidationResult contract:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | "approved" / "blocked" / "needs_confirmation" | Yes | Validation outcome |
| command | string | Yes | Original command |
| subCommands | string[] | Yes | Individual sub-commands after splitting |
| blockedReason | string | No | Why the command was blocked (denylist match) |
| classification | ReversibilityResult | No | Reversibility details (when needs_confirmation) |

**VS Code Settings:**

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| agentx.security.commandAllowlist | string[] | (see default list) | Commands that auto-execute without confirmation |
| agentx.security.commandDenylist | string[] | ["rm -rf /", "format c:", "drop database", "git reset --hard"] | Hard-blocked commands (defense in depth) |

**Default Allowlist (initial):**

| Category | Commands |
|----------|----------|
| Git | git status, git diff, git log, git branch, git stash, git checkout, git add, git commit, git push, git pull, git fetch, git merge, git rebase |
| Node.js | npm install, npm test, npm run, npm ls, npx, node |
| File ops | ls, dir, cat, type, head, tail, find, tree, pwd, cd, mkdir, cp, mv, echo |
| .NET | dotnet build, dotnet test, dotnet run, dotnet restore |
| Python | python, pip install, pip list, pytest, python -m |
| Tools | code, grep, wc, sort, which, where |

---

### 3.2 SecretRedactor Interface

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| redactSecrets | input: string | string | Replace credential patterns with [REDACTED:type] |
| addPattern | pattern: RedactionPattern | void | Register an additional redaction pattern |

**Redaction Patterns:**

| Pattern Name | Regex Target | Replacement |
|-------------|-------------|-------------|
| bearer | Bearer [A-Za-z0-9\-._~+/]+ | [REDACTED:bearer] |
| openai-key | sk-[A-Za-z0-9]{20,} | [REDACTED:openai-key] |
| github-pat | ghp_[A-Za-z0-9]{36} | [REDACTED:github-pat] |
| github-oauth | gho_[A-Za-z0-9]{36} | [REDACTED:github-oauth] |
| github-fine | github_pat_[A-Za-z0-9_]{22,} | [REDACTED:github-fine-pat] |
| aws-access-key | AKIA[0-9A-Z]{16} | [REDACTED:aws-key] |
| azure-conn | (AccountKey\|SharedAccessKey)=[A-Za-z0-9+/=]{20,} | [REDACTED:azure-conn] |
| password-field | (password\|passwd\|pwd)=[^\s&;]+ | [REDACTED:password] |
| secret-field | (secret\|api_secret)=[^\s&;]+ | [REDACTED:secret] |
| token-field | (token\|access_token\|refresh_token)=[^\s&;]+ | [REDACTED:token] |
| jwt-segment | eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+ | [REDACTED:jwt] |
| private-key-block | -----BEGIN (RSA\|EC\|DSA\|OPENSSH)? ?PRIVATE KEY----- | [REDACTED:private-key] |

---

### 3.3 ReversibilityClassifier Interface

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| classify | command: string | ReversibilityResult | Classify command risk and provide undo hint |
| addPattern | category, PatternRule | void | Register additional classification patterns |

**Classification Rules:**

| Category | Warning Level | Example Commands | Undo Hint |
|----------|--------------|------------------|-----------|
| easy | info | git stash, git checkout -- file, cp (with backup), mv (within workspace) | "Undo: git stash pop", "Undo: git checkout -- {file}" |
| effort | warning | file overwrite (no backup), npm uninstall, pip uninstall, directory restructure | "Manual restore may be needed. Check version control." |
| irreversible | danger | rm -rf, DROP TABLE, TRUNCATE, git push --force (without lease), format | "WARNING: This action cannot be undone." |

---

### 3.4 PathSandbox Interface

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| validatePath | inputPath: string | PathValidationResult | Check if path is within sandbox boundaries |
| isTraversalAttempt | inputPath: string | boolean | Detect ../ path traversal patterns |

**VS Code Settings:**

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| agentx.security.blockedPaths | string[] | [".ssh", ".aws", ".gnupg", ".azure", ".kube"] | Directories blocked from agent access |
| agentx.security.blockedFilePatterns | string[] | [".env", "*.pem", "*.key", "*password*", "*secret*", "*.pfx", "*.p12"] | File patterns blocked from agent access |
| agentx.security.workspaceSandbox | boolean | true | Restrict all file access to workspace root |

---

### 3.5 StructuredLogger Interface

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| log | entry: LogEntry | void | Write a structured log entry |
| debug | agent, message, meta | void | Debug-level log convenience method |
| info | agent, message, meta | void | Info-level log convenience method |
| warn | agent, message, meta | void | Warning-level log convenience method |
| error | agent, message, meta | void | Error-level log convenience method |

**Log Entry JSON Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| timestamp | string (ISO 8601) | Yes | Entry timestamp |
| level | "debug" / "info" / "warn" / "error" | Yes | Log severity |
| correlationId | string (UUID) | Yes | Traces related entries across a loop iteration |
| agentName | string | Yes | Which agent produced the entry |
| toolName | string | No | Tool being executed (if applicable) |
| message | string | Yes | Human-readable log message |
| durationMs | number | No | Operation duration in milliseconds |
| metadata | object | No | Additional key-value context |

**Rotation Configuration:**

| Parameter | Value |
|-----------|-------|
| Max file size | 10 MB |
| Max rotated files | 5 |
| Log directory | .agentx/logs/ |
| Filename pattern | agentx-{YYYY-MM-DD}.jsonl |
| Total max disk usage | 50 MB |

---

### 3.6 RetryWithBackoff Interface

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| withRetry | fn: () => Promise, config: RetryConfig, log?: callback | Promise | Execute fn with retry logic |

**RetryConfig:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| maxRetries | 5 | Maximum retry attempts |
| baseDelayMs | 1000 | Initial delay in ms |
| maxDelayMs | 32000 | Maximum delay cap in ms |
| multiplier | 2 | Backoff multiplier |
| jitterPercent | 0.2 | Random jitter (+/- 20%) |
| retryableStatuses | [429, 500, 502, 503] | HTTP status codes that trigger retry |

**Delay Formula:** delay = min(baseDelayMs * multiplier^(attempt-1), maxDelayMs) * (1 +/- jitterPercent)

**Retry Sequence:**

| Attempt | Base Delay | With Jitter (range) |
|---------|-----------|---------------------|
| 1 | 1,000 ms | 800 - 1,200 ms |
| 2 | 2,000 ms | 1,600 - 2,400 ms |
| 3 | 4,000 ms | 3,200 - 4,800 ms |
| 4 | 8,000 ms | 6,400 - 9,600 ms |
| 5 | 16,000 ms | 12,800 - 19,200 ms |

---

### 3.7 ProgressTracker Interface

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| initialize | objective, plan | void | Set up task and progress ledgers |
| recordSuccess | stepIndex, result | void | Record step success, reset stall counter |
| recordFailure | stepIndex, error | void | Record step failure, increment stall counter |
| isStalled | (none) | boolean | true if stallCount >= threshold |
| isStale | (none) | boolean | true if no progress for staleTimeoutMs |
| getRePlanContext | (none) | RePlanContext | Context for LLM replanning |
| reset | (none) | void | Reset ledgers for new plan |

**Configuration:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| stallThreshold | 3 | Consecutive failures before replan trigger |
| staleTimeoutMs | 60000 | Milliseconds without progress before stale warning |
| maxReplans | 2 | Maximum replans before aborting (prevent infinite replan) |

---

### 3.8 ParallelToolExecutor Interface

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| analyzeAndExecute | calls, registry, ctx | Promise of ToolResult[] | Analyze dependencies and execute (parallel or sequential) |
| detectDependencies | calls | DependencyGraph | Identify data dependencies between calls |

**Dependency Detection Heuristics:**

| Heuristic | Description |
|-----------|-------------|
| Shared file path | If tool A writes a file and tool B reads the same file, B depends on A |
| Tool output reference | If tool B's params reference tool A's call ID, B depends on A |
| Mutating + same resource | Two mutating tools targeting the same resource are sequential |
| Default | All read-only tools with different targets are independent |

---

## 4. Data Model Diagrams

### 4.1 Configuration Data Model

```mermaid
erDiagram
    VSCodeSettings {
        string_array commandAllowlist "agentx.security.commandAllowlist"
        string_array commandDenylist "agentx.security.commandDenylist"
        string_array blockedPaths "agentx.security.blockedPaths"
        string_array blockedFilePatterns "agentx.security.blockedFilePatterns"
        boolean workspaceSandbox "agentx.security.workspaceSandbox"
        number maxRetries "agentx.reliability.maxRetries"
        number stallThreshold "agentx.reliability.stallThreshold"
        string logLevel "agentx.logging.level"
        number maxLogFileSizeMB "agentx.logging.maxFileSizeMB"
        number maxLogFiles "agentx.logging.maxFiles"
        number maxMessages "agentx.loop.maxMessages"
    }
```

### 4.2 Progress Ledger Data Model

```mermaid
erDiagram
    TaskLedger {
        string objective "High-level goal"
        string_array facts "Known facts"
        string_array assumptions "Working assumptions"
        PlanStep_array plan "Ordered plan steps"
        string createdAt "ISO 8601"
        string updatedAt "ISO 8601"
    }

    ProgressLedger {
        number currentStepIndex "Active step"
        StepRecord_array stepHistory "All step records"
        number stallCount "Consecutive failures"
        number lastProgressTimestamp "Unix ms"
        number totalReplans "Replan count"
    }

    PlanStep {
        number index "Step number"
        string description "What to do"
        string status "pending/active/done/failed"
    }

    StepRecord {
        number stepIndex "Which step"
        string status "success/failure"
        number timestamp "Unix ms"
        string detail "Optional context"
        number durationMs "How long"
    }

    TaskLedger ||--o{ PlanStep : "contains"
    ProgressLedger ||--o{ StepRecord : "contains"
```

### 4.3 Structured Log Entry Data Model

```mermaid
erDiagram
    LogEntry {
        string timestamp "ISO 8601"
        string level "debug/info/warn/error"
        string correlationId "UUID v4"
        string agentName "Agent producing entry"
        string toolName "Optional tool name"
        string message "Human-readable message"
        number durationMs "Optional duration"
        JSON metadata "Optional key-value context"
    }

    LogFile {
        string path ".agentx/logs/agentx-DATE.jsonl"
        number sizeBytes "Current file size"
        number entryCount "Entries in file"
        string createdAt "File creation time"
    }

    LogFile ||--o{ LogEntry : "contains"
```

### 4.4 Persistent Memory Data Model (P2)

```mermaid
erDiagram
    MemoryEntry {
        string key "Unique identifier"
        string value "Stored observation"
        string_array tags "Categorization tags"
        number createdAt "Unix ms"
        number expiresAt "Unix ms (TTL-based)"
        string agent "Which agent stored it"
    }

    MemoryStore {
        string path ".agentx/memory/observations.jsonl"
        number entryCount "Active entries"
        number prunedCount "Expired and removed"
    }

    MemoryStore ||--o{ MemoryEntry : "contains"
```

---

## 5. Service Layer Diagrams

### 5.1 Security Service Architecture

```mermaid
graph TD
    subgraph ToolExecution[" TOOL EXECUTION LAYER"]
        TE["ToolEngine.execute()<br/>Entry point for all tool calls"]
    end

    subgraph Security[" SECURITY SERVICE LAYER"]
        CV["CommandValidator<br/>Denylist check -> Compound split -> Allowlist check"]
        RC["ReversibilityClassifier<br/>easy / effort / irreversible categorization"]
        PSB["PathSandbox<br/>Workspace boundary + blocked dirs/patterns"]
        SSRF["SsrfValidator<br/>IP ranges + schemes + DNS resolution"]
        SR["SecretRedactor<br/>Regex-based credential stripping"]
    end

    subgraph Config[" CONFIGURATION"]
        VSC["VS Code Settings API<br/>agentx.security.* namespace"]
    end

    TE -->|"terminal_exec calls"| CV
    CV -->|"needs_confirmation"| RC
    TE -->|"file_read/write calls"| PSB
    TE -->|"HTTP request calls"| SSRF
    SR -->|"all output paths"| TE
    VSC -->|"loadConfig()"| CV
    VSC -->|"loadConfig()"| PSB
```

### 5.2 Reliability Service Architecture

```mermaid
graph TD
    subgraph Loop[" AGENTIC LOOP LAYER"]
        AL["AgenticLoop.executeLoop()<br/>Main LLM-tool cycle"]
    end

    subgraph Reliability[" RELIABILITY SERVICE LAYER"]
        PT["ProgressTracker<br/>Dual-ledger + stall detection + replan"]
        PTE["ParallelToolExecutor<br/>Dependency analysis + Promise.allSettled"]
        RB["RetryWithBackoff<br/>Exponential backoff + jitter + transient detection"]
    end

    subgraph Observability[" OBSERVABILITY SERVICE LAYER"]
        SLG["StructuredLogger<br/>JSON entries + file rotation + correlation IDs"]
        TL["ThinkingLog (extended)<br/>Output channel + event bus + redaction"]
    end

    AL -->|"each iteration"| PT
    AL -->|"multi-tool responses"| PTE
    AL -.->|"via LlmAdapter"| RB
    PT -->|"events"| TL
    PTE -->|"timing"| SLG
    RB -->|"retry logs"| SLG
    SLG --> SR["SecretRedactor"]
    TL --> SR
```

---

## 6. Security Diagrams

### 6.1 Defense-in-Depth Architecture

The following diagram shows the layered security model for command execution, file access, and network requests. Each layer operates independently -- bypassing one layer does not bypass others.

```mermaid
graph TD
    L1["Layer 1: Hard Denylist<br/>4 patterns: rm -rf /, format c:, drop database, git reset --hard<br/>ALWAYS blocks, cannot be overridden"]
    L2["Layer 2: Allowlist Validation<br/>Only allowlisted commands auto-execute<br/>Unknown commands require user confirmation"]
    L3["Layer 3: Compound Command Analysis<br/>Split on ; && || pipe<br/>Each sub-command validated independently"]
    L4["Layer 4: Reversibility Classification<br/>easy / effort / irreversible categories<br/>Undo hints displayed to user"]
    L5["Layer 5: Path Sandboxing<br/>Workspace boundary enforcement<br/>Blocked directories and file patterns"]
    L6["Layer 6: Secret Redaction<br/>12+ regex patterns for credentials<br/>Applied to all output before display/persistence"]
    L7["Layer 7: SSRF Protection (P2)<br/>Private IP blocking, DNS resolution validation<br/>Non-HTTP scheme blocking"]

    L1 --> L2 --> L3 --> L4
    L5 -.->|"parallel check"| L2
    L6 -.->|"output filter"| L4
    L7 -.->|"network filter"| L2

    style L1 fill:#FFEBEE,stroke:#C62828
    style L2 fill:#FFF3E0,stroke:#E65100
    style L3 fill:#FFFDE7,stroke:#F9A825
    style L4 fill:#E8F5E9,stroke:#2E7D32
    style L5 fill:#E3F2FD,stroke:#1565C0
    style L6 fill:#F3E5F5,stroke:#6A1B9A
    style L7 fill:#E0F7FA,stroke:#00838F
```

### 6.2 Command Validation Decision Flow

```mermaid
graph TD
    START["LLM requests command execution"] --> DENY{"Matches<br/>denylist?"}
    DENY -->|Yes| BLOCK["BLOCK<br/>Return error to LLM"]
    DENY -->|No| SPLIT["Split compound command<br/>on ; && || pipe"]
    SPLIT --> ALLOW{"ALL sub-commands<br/>in allowlist?"}
    ALLOW -->|Yes| EXEC["AUTO-EXECUTE<br/>Run command"]
    ALLOW -->|No| CLASS["Classify reversibility"]
    CLASS --> DIALOG["Show confirmation dialog<br/>Command + Category + Undo hint"]
    DIALOG --> USER{"User<br/>response?"}
    USER -->|Approve| EXEC
    USER -->|Deny| DENIED["Return denial to LLM"]
    USER -->|Timeout 30s| DENIED

    style BLOCK fill:#FFEBEE,stroke:#C62828
    style EXEC fill:#E8F5E9,stroke:#2E7D32
    style DENIED fill:#FFF3E0,stroke:#E65100
```

### 6.3 Path Sandboxing Decision Flow

```mermaid
graph TD
    START["File operation requested"] --> RESOLVE["Resolve to absolute path"]
    RESOLVE --> TRAVERSE{"Path traversal<br/>detected?<br/>(../ patterns)"}
    TRAVERSE -->|Yes| BLOCK["BLOCK<br/>Path traversal attempt"]
    TRAVERSE -->|No| SANDBOX{"Within workspace<br/>sandbox?"}
    SANDBOX -->|No| BLOCK2["BLOCK<br/>Outside workspace boundary"]
    SANDBOX -->|Yes| DIRCHECK{"Matches blocked<br/>directory?"}
    DIRCHECK -->|Yes| BLOCK3["BLOCK<br/>Sensitive directory"]
    DIRCHECK -->|No| FILECHECK{"Matches blocked<br/>file pattern?"}
    FILECHECK -->|Yes| BLOCK4["BLOCK<br/>Sensitive file pattern"]
    FILECHECK -->|No| ALLOW["ALLOW<br/>Proceed with operation"]

    style BLOCK fill:#FFEBEE,stroke:#C62828
    style BLOCK2 fill:#FFEBEE,stroke:#C62828
    style BLOCK3 fill:#FFEBEE,stroke:#C62828
    style BLOCK4 fill:#FFEBEE,stroke:#C62828
    style ALLOW fill:#E8F5E9,stroke:#2E7D32
```

### 6.4 Secret Redaction Coverage

| Threat | Pattern | Defense |
|--------|---------|---------|
| Bearer token leak | Authorization: Bearer xxx | [REDACTED:bearer] |
| OpenAI API key in logs | sk-proj-xxx | [REDACTED:openai-key] |
| GitHub PAT in output | ghp_xxx / gho_xxx / github_pat_xxx | [REDACTED:github-pat/oauth/fine-pat] |
| AWS key in env dump | AKIA1234567890ABCD | [REDACTED:aws-key] |
| Azure connection string | AccountKey=xxx | [REDACTED:azure-conn] |
| Password in URL/config | password=hunter2 | [REDACTED:password] |
| JWT token in logs | eyJhbGciOi...eyJzdWIi...sig | [REDACTED:jwt] |
| Private key block | -----BEGIN PRIVATE KEY----- | [REDACTED:private-key] |

---

## 7. Performance

### 7.1 Performance Requirements

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Secret redaction latency | < 1 ms per entry | Pre-compiled regex, benchmark with 1KB strings |
| Command validation latency | < 5 ms per command | Includes compound splitting + allowlist lookup |
| Parallel tool execution speedup | Up to Nx for N independent calls | Compare wall-clock time parallel vs sequential |
| Structured logging throughput | 1000+ entries/sec non-blocking | Async file writes, buffered output |
| Retry total duration | < 2 min worst case (5 retries) | Sum of all backoff delays with max jitter |
| Progress ledger overhead | < 1 ms per update | In-memory data structures, no I/O per step |
| Path validation latency | < 2 ms per check | Path resolution + pattern matching |

### 7.2 Optimization Strategies

- **Secret Redaction**: Pre-compile all regex patterns at module load; reuse compiled patterns across all calls. Patterns are stateless and thread-safe.
- **Command Validation**: Store allowlist in a Set for O(1) lookup per sub-command. Compound splitting uses a single regex pass.
- **Structured Logging**: Use buffered async writes to avoid blocking the agentic loop. Write entries as newline-delimited JSON (JSONL) for append-only efficiency.
- **Parallel Execution**: Use Promise.allSettled (not Promise.all) so one failure does not cancel others. Dependency detection is a lightweight heuristic pass before execution.
- **Retry Backoff**: Jitter prevents thundering herd on shared LLM endpoints. Non-transient errors (400, 401, 403) are never retried.

### 7.3 Caching Strategy

| Component | Cache Type | TTL | Invalidation |
|-----------|-----------|-----|-------------|
| Allowlist Set | In-memory Set | Until config change | VS Code onDidChangeConfiguration event |
| Compiled regex (redactor) | Module-level singleton | Application lifetime | Never (immutable patterns) |
| Compiled regex (path patterns) | Module-level singleton | Until config change | VS Code onDidChangeConfiguration event |
| Reversibility patterns | Module-level array | Application lifetime | Never (extensible but immutable once loaded) |

---

## 8. Testing Strategy

### 8.1 Test Pyramid

```mermaid
graph TD
    E2E["Integration Tests - 10%<br/>Full agentic loop with mock LLM<br/>Command validation end-to-end"]
    INT["Module Integration Tests - 20%<br/>Security layer + ToolEngine<br/>Logger + Redactor pipeline"]
    UNIT["Unit Tests - 70%<br/>CommandValidator, SecretRedactor,<br/>ReversibilityClassifier, PathSandbox,<br/>RetryWithBackoff, ProgressTracker,<br/>ParallelToolExecutor, StructuredLogger"]
    COV["Coverage Target: >= 80% per new module"]

    E2E --- INT --- UNIT --- COV

    style E2E fill:#F44336,stroke:#D32F2F
    style INT fill:#FF9800,stroke:#F57C00
    style UNIT fill:#4CAF50,stroke:#388E3C
    style COV fill:#2196F3,stroke:#1565C0
```

### 8.2 Test Coverage by Module

| Module | Test File | Key Test Cases | Min Coverage |
|--------|-----------|---------------|-------------|
| commandValidator.ts | commandValidator.test.ts | Allowlisted passes; unknown prompts; compound splitting; denylist override; empty command; config reload | 80% |
| secretRedactor.ts | secretRedactor.test.ts | Each credential pattern; idempotent double-redaction; no false positives on common words; empty string; multi-pattern string | 80% |
| reversibilityClassifier.ts | reversibilityClassifier.test.ts | easy commands with undo hints; effort commands with warnings; irreversible with danger; unknown defaults to effort; custom patterns | 80% |
| pathSandbox.ts | pathSandbox.test.ts | Workspace boundary; blocked dirs; blocked patterns; traversal detection (../../); config reload; read vs write | 80% |
| retryWithBackoff.ts | retryWithBackoff.test.ts | Retry count; backoff timing; jitter range; non-retriable errors (400, 401); max delay cap; abort signal | 80% |
| progressTracker.ts | progressTracker.test.ts | Stall detection at threshold; replan trigger; stale timeout; reset after replan; max replans; ledger serialization | 80% |
| parallelToolExecutor.ts | parallelToolExecutor.test.ts | Parallel execution (mock timing); result ordering; one failure preserved; dependency fallback to sequential; mixed read/write | 80% |
| structuredLogger.ts | structuredLogger.test.ts | JSON format; rotation trigger at 10 MB; correlation ID propagation; secret redaction integration; file retention limit | 80% |

### 8.3 Integration Test Scenarios

| Scenario | Components | Validation |
|----------|-----------|------------|
| Allowlist command flows through ToolEngine | CommandValidator + ToolEngine | Allowlisted command executes; unknown triggers confirmation mock |
| Secret redaction in full logging pipeline | SecretRedactor + ThinkingLog + StructuredLogger | Bearer token in tool output never appears in log file |
| Parallel execution with mock tools | ParallelToolExecutor + ToolRegistry + mock tools | 3 independent tools complete faster than 3x single-tool time |
| Retry with mock LLM adapter | RetryWithBackoff + VsCodeLmAdapter (mocked) | 429 retried 3 times then succeeds; 401 never retried |
| Stall detection triggers replan | ProgressTracker + AgenticLoop (mocked) | 3 failures triggers replan; stall count resets after replan |

---

## 9. Implementation Notes

### 9.1 New File Structure

```
vscode-extension/src/
  agentic/
    agenticLoop.ts              # MODIFIED - integrate ProgressTracker, ParallelToolExecutor
    toolEngine.ts               # MODIFIED - integrate CommandValidator, PathSandbox
    subAgentSpawner.ts          # MODIFIED (P2) - add runParallel()
    progressTracker.ts          # NEW - TaskLedger + ProgressLedger + stall detection
    parallelToolExecutor.ts     # NEW - dependency analysis + Promise.allSettled
    codebaseAnalysis.ts         # NEW (P2) - analyze_codebase, find_dependencies, map_architecture
    ssrfValidator.ts            # NEW (P2) - URL/IP validation
  chat/
    vscodeLmAdapter.ts          # MODIFIED - integrate RetryWithBackoff
  utils/
    secretRedactor.ts           # NEW - regex-based credential stripping
    commandValidator.ts         # NEW - allowlist + denylist + compound splitting
    reversibilityClassifier.ts  # NEW - easy/effort/irreversible classification
    pathSandbox.ts              # NEW - workspace boundary + blocked dirs/patterns
    retryWithBackoff.ts         # NEW - exponential backoff + jitter
    structuredLogger.ts         # NEW - JSON logging + file rotation
    thinkingLog.ts              # MODIFIED - integrate SecretRedactor
    contextCompactor.ts         # MODIFIED (P3) - bounded message pruning
  memory/
    persistentStore.ts          # NEW (P2) - JSONL-based cross-session memory
  test/
    utils/
      commandValidator.test.ts  # NEW
      secretRedactor.test.ts    # NEW
      reversibilityClassifier.test.ts  # NEW
      pathSandbox.test.ts       # NEW
      retryWithBackoff.test.ts  # NEW
      structuredLogger.test.ts  # NEW
    agentic/
      progressTracker.test.ts   # NEW
      parallelToolExecutor.test.ts  # NEW
```

### 9.2 VS Code Settings Schema Additions (package.json)

| Setting Key | Type | Default | Phase |
|-------------|------|---------|-------|
| agentx.security.commandAllowlist | array of string | (default allowlist) | P0 |
| agentx.security.commandDenylist | array of string | (4 existing patterns) | P0 |
| agentx.security.blockedPaths | array of string | [".ssh", ".aws", ".gnupg", ".azure", ".kube"] | P1 |
| agentx.security.blockedFilePatterns | array of string | [".env", "*.pem", "*.key", "*password*", "*secret*", "*.pfx", "*.p12"] | P1 |
| agentx.security.workspaceSandbox | boolean | true | P1 |
| agentx.reliability.maxRetries | number | 5 | P1 |
| agentx.reliability.stallThreshold | number | 3 | P1 |
| agentx.reliability.staleTimeoutSec | number | 60 | P1 |
| agentx.logging.level | string (enum) | "info" | P1 |
| agentx.logging.maxFileSizeMB | number | 10 | P1 |
| agentx.logging.maxFiles | number | 5 | P1 |
| agentx.loop.maxMessages | number | 200 | P3 |

### 9.3 Dependencies

No new external npm dependencies required. All implementations use:

- Node.js built-in modules: fs, path, crypto (for UUID), os
- VS Code Extension API: vscode.workspace.getConfiguration, vscode.window.showWarningMessage, vscode.window.showInformationMessage
- Existing internal modules: eventBus.ts (event dispatch), thinkingLog.ts (output), toolEngine.ts (tool registry)

### 9.4 Configuration Loading Pattern

All configurable modules follow the same pattern:

1. Load configuration at module initialization from VS Code settings
2. Register a listener on `vscode.workspace.onDidChangeConfiguration`
3. On change event with matching section prefix, reload configuration
4. Expose a `reload()` method for testing without VS Code API

### 9.5 Backward Compatibility

| Concern | Mitigation |
|---------|-----------|
| Existing tool definitions | ToolRegistry API unchanged; new validators are internal to ToolEngine |
| Agent configurations | All new AgenticLoopConfig fields are optional with defaults |
| Current denylist behavior | Denylist remains as Layer 1; allowlist is additive Layer 2 |
| Sequential tool execution | Default behavior unchanged; parallel requires LLM to return multiple calls |
| No retry (current) | RetryWithBackoff wraps existing adapter; zero-retry config disables it |
| ThinkingLog consumers | SecretRedactor integration is transparent; output format unchanged |

---

## 10. Rollout Plan

### Phase 1: Security Foundation (Weeks 1-2)

**Stories**: US-1.1, US-1.2, US-1.3

| Week | Deliverable | Files |
|------|-------------|-------|
| Week 1 | CommandValidator + ReversibilityClassifier | commandValidator.ts, reversibilityClassifier.ts, toolEngine.ts (integration) |
| Week 1 | SecretRedactor | secretRedactor.ts, thinkingLog.ts (integration) |
| Week 2 | Unit tests for all Phase 1 modules | *.test.ts files |
| Week 2 | VS Code settings schema for allowlist | package.json (contributes.configuration) |

**Validation Gate**: All Phase 1 tests pass; >= 80% coverage per module; manual test of confirmation dialog with reversibility display.

### Phase 2: Reliability and Observability (Weeks 3-4)

**Stories**: US-2.1, US-2.2, US-2.3, US-1.4, US-3.1

| Week | Deliverable | Files |
|------|-------------|-------|
| Week 3 | ProgressTracker (dual-ledger) | progressTracker.ts, agenticLoop.ts (integration) |
| Week 3 | RetryWithBackoff | retryWithBackoff.ts, vscodeLmAdapter.ts (integration) |
| Week 3 | PathSandbox | pathSandbox.ts, toolEngine.ts (integration) |
| Week 4 | ParallelToolExecutor | parallelToolExecutor.ts, agenticLoop.ts (integration) |
| Week 4 | StructuredLogger | structuredLogger.ts |
| Week 4 | Unit + integration tests | *.test.ts files |

**Validation Gate**: All Phase 2 tests pass; parallel execution shows measurable speedup; log rotation verified at 10 MB boundary.

### Phase 3: Advanced Capabilities (Weeks 5-6)

**Stories**: US-2.4, US-1.5, US-4.1, US-4.2, US-4.3, US-4.4, US-3.2, US-4.5, US-2.5

| Week | Deliverable | Files |
|------|-------------|-------|
| Week 5 | OnError hook + SSRF validator + Codebase tools | agenticLoop.ts, ssrfValidator.ts, codebaseAnalysis.ts |
| Week 5 | Parallel agent executor + Persistent memory | subAgentSpawner.ts, persistentStore.ts |
| Week 6 | Prompting modes + Timing utilities + Hook priority + Bounded messages | Various modifications |
| Week 6 | Final integration tests + documentation | *.test.ts, README, GUIDE.md |

**Validation Gate**: All tests pass; documentation updated; >= 80% coverage on new modules.

---

## 11. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Allowlist too restrictive at launch | High | High | Ship with broad default allowlist covering git, npm, dotnet, python, file ops; easy extension via settings; monitor user feedback in first 2 weeks |
| Secret redaction false positives | Medium | Medium | Test against real codebase output; common code identifiers (e.g., "token" as variable name) excluded from field-value patterns; patterns require = delimiter |
| Parallel tool execution race conditions | High | Medium | Use Promise.allSettled (not Promise.all); tools have isolated ToolContext; no shared mutable state; integration tests with concurrent mock tools |
| Retry backoff perceived as slowness | Medium | Low | Display retry status and countdown in ThinkingLog; user can abort via CancellationToken; configurable max retries |
| Stall detection replans too aggressively | Medium | Medium | Configurable stallThreshold (default 3); maxReplans cap (default 2) prevents infinite replan; replan reasoning logged |
| Path sandboxing blocks legitimate access | Medium | Medium | Configurable boundaries; node_modules readable by default; clear error messages guide users to adjust settings |
| Scope creep across 17 stories | High | High | Strict phase-based delivery; P0 shipped and validated before P1 begins; P3 deferred if P0/P1 slip |
| Breaking change in ToolEngine API | High | Low | All new validators are internal; ToolRegistry public API unchanged; AgenticLoopConfig uses optional fields with defaults |

---

## 12. Monitoring & Observability

### 12.1 Structured Log Events

All events emitted by new components follow the LogEntry schema defined in Section 3.5.

| Event | Level | Agent | Message Pattern | Metadata |
|-------|-------|-------|-----------------|----------|
| Command allowlisted | info | (caller) | "Command auto-approved: {cmd}" | { subCommands, source: "allowlist" } |
| Command blocked (denylist) | warn | (caller) | "Command blocked by denylist: {pattern}" | { command, pattern } |
| Command confirmation requested | info | (caller) | "Confirmation requested: {classification}" | { command, reversibility, undoHint } |
| Secret redacted | debug | system | "Redacted {count} secrets from output" | { patternTypes } |
| Stall detected | warn | (agent) | "Stall detected: {stallCount} consecutive failures" | { stallCount, lastErrors } |
| Replan triggered | info | (agent) | "Replanning: {reason}" | { objective, failedSteps } |
| Stale warning | warn | (agent) | "No progress for {seconds}s" | { lastProgressTimestamp } |
| Retry attempt | info | system | "LLM retry attempt {n}/{max}, delay {ms}ms" | { attempt, delay, errorType, statusCode } |
| Parallel execution | info | (agent) | "Parallel: {n} tools in {ms}ms" | { toolNames, durations, sequential: false } |
| Log rotation | info | system | "Log file rotated: {oldFile} -> {newFile}" | { oldSize, newFile } |
| Path blocked | warn | (caller) | "Path access denied: {reason}" | { path, blockedBy } |

### 12.2 Correlation ID Propagation

```mermaid
graph LR
    subgraph Iteration["Single Loop Iteration"]
        CID["correlationId = uuid()"]
        L1["LLM call logged"]
        T1["Tool call logged"]
        T2["Tool result logged"]
        R1["Redaction applied"]
        L2["LLM response logged"]
    end

    CID --> L1 --> T1 --> T2 --> R1 --> L2

    Note["All entries share the same correlationId<br/>for end-to-end tracing of one iteration"]
```

A new correlation ID is generated at the start of each agentic loop iteration. All log entries within that iteration (LLM call, tool executions, results, redactions) share the same correlation ID. This enables filtering all entries for a single iteration in log analysis tools.

### 12.3 Alert Conditions

| Condition | Trigger | Severity | Action |
|-----------|---------|----------|--------|
| Denylist command blocked | Any denylist match | High | Log + event bus notification |
| Multiple stalls in single session | stallCount >= 3 twice | High | Log + stale warning event |
| LLM retry exhausted | 5 retries failed | Critical | Error event + loop termination |
| Log rotation failure | Disk write error | Medium | Fallback to console; emit warning |
| Secret detected in output | Any redaction trigger | Low (expected) | Debug-level log of pattern count |

---

**Generated by AgentX Architect Agent**
**Last Updated**: 2026-03-03
**Version**: 1.0
