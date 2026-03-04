# PRD: Cognitive Foundation -- Outcome Learning, Episodic Memory, Confidence Markers & Memory Health

**Epic**: Phase 1 -- Cognitive Foundation
**Status**: Draft
**Author**: Product Manager Agent
**Date**: 2026-03-04
**Stakeholders**: Engineer, Architect, Reviewer
**Priority**: p1

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

AgentX agents execute tasks effectively but do not **learn from past outcomes**. The self-review loop validates code quality in the moment but discards lessons. There is no way to recall what happened in prior sessions, no uncertainty signals in agent deliverables, and the memory store accumulates stale data with no health maintenance.

### Why is this important?

- Engineers waste time on recurring mistakes the system already solved before.
- Resuming work after a break requires manually re-reading files to rebuild context.
- Reviewers and Engineers cannot distinguish high-confidence recommendations from speculative ones in Architect ADRs.
- The `.agentx/memory/` folder grows unbounded with orphaned files and stale observations.

### What happens if we don't solve this?

AgentX remains a stateless executor -- powerful but unable to compound knowledge. Each session starts from scratch. Memory stores degrade over time. Agent output quality does not improve with usage.

---

## 2. Target Users

### Primary Users

**Solo Developer (Local Mode)**
- Uses AgentX on personal projects
- Switches between projects frequently
- Wants past lessons applied automatically to new work
- Frustrated by repeating the same debugging patterns

**Team Lead (GitHub Mode)**
- Oversees 3-5 engineers using AgentX
- Needs visibility into agent decision confidence
- Wants to trust that agents learn from repeated patterns

### Secondary Users

- **Code Reviewers** who consume Architect ADRs and Engineer PRs -- benefit from confidence markers
- **DevOps Engineers** who need session continuity when debugging deployment pipelines across days

---

## 3. Goals & Success Metrics

### Business Goals

1. **Compound agent intelligence**: Agents improve output quality over time by leveraging past outcomes
2. **Session continuity**: Users can resume work seamlessly after interruptions
3. **Transparent uncertainty**: Agent deliverables signal confidence levels, reducing downstream rework
4. **Store reliability**: Memory store remains healthy and performant as usage grows

### Success Metrics (KPIs)

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Outcome records per quality loop | 0 | 1 per loop completion | v7.4.0 |
| Session summaries auto-captured | 0 | 1 per compaction event | v7.4.0 |
| Agent outputs with confidence markers | 0% | 100% of Architect/Reviewer outputs | v7.4.0 |
| Memory health check available | No | Yes, via command | v7.4.0 |
| Orphaned memory files detected/repaired | N/A | 100% detected, auto-repaired | v7.4.0 |

### User Success Criteria

- User can query "what went wrong last time on issue #42?" and get a structured answer
- Architect ADR sections include `[Confidence: HIGH/MEDIUM/LOW]` markers
- `agentx.memoryHealth` command reports store integrity in under 2 seconds

---

## 4. Requirements

### 4.1 Functional Requirements

#### Must Have (P0)

1. **Outcome Tracker**: Record structured outcomes after each quality loop completion
   - **User Story**: As an Engineer, I want the system to record what succeeded and failed in each quality loop so that future similar tasks benefit from past lessons
   - **Acceptance Criteria**:
     - [ ] Each quality loop completion writes an outcome record to `.agentx/memory/outcomes/`
     - [ ] Record includes: agent, issue, action summary, outcome (pass/fail), root cause (if fail), lesson learned
     - [ ] Outcomes are queryable by agent, issue, or keyword
     - [ ] Outcome query returns results in < 500ms for stores with < 1000 records

2. **Episodic Memory (Session Recorder)**: Auto-capture session summaries at context compaction
   - **User Story**: As a Developer, I want to see what happened in my last session so that I can resume work without re-reading all files
   - **Acceptance Criteria**:
     - [ ] Context compactor triggers session recording automatically
     - [ ] Session record includes: agent, issue, actions performed, decisions made, timestamp range
     - [ ] Sessions stored in `.agentx/memory/sessions/session-{date}-{id}.json`
     - [ ] Sessions queryable by date, agent, issue, or keyword
     - [ ] `agentx.sessionHistory` command lists recent sessions

3. **Confidence Markers**: Agent outputs include uncertainty signals
   - **User Story**: As a Reviewer, I want Architect ADRs to indicate confidence levels so that I know which recommendations need deeper scrutiny
   - **Acceptance Criteria**:
     - [ ] Architect agent prompt template includes confidence marker instructions
     - [ ] Reviewer agent prompt template includes confidence marker instructions
     - [ ] Markers use standard format: `[Confidence: HIGH]`, `[Confidence: MEDIUM]`, `[Confidence: LOW]`
     - [ ] At least one marker per major section in ADR and Review outputs

4. **Memory Health Command**: Validate and repair memory store integrity
   - **User Story**: As a Developer, I want to check and auto-repair my memory store so that stale data does not degrade performance
   - **Acceptance Criteria**:
     - [ ] `agentx.memoryHealth` command scans manifest.json against actual files
     - [ ] Detects: orphaned files, missing manifest entries, corrupt JSON, stale observations (> 90 days)
     - [ ] Generates a health report: total entries, orphans found, stale count, store size
     - [ ] `--fix` flag auto-repairs: rebuilds manifest from disk, removes orphaned files
     - [ ] Completes in < 2 seconds for stores with < 5000 observations

#### Should Have (P1)

5. **Outcome-Informed Prompts**: Query past outcomes before starting similar work
   - **User Story**: As an Engineer, I want the system to remind me of past failures on similar tasks so that I avoid repeating mistakes
   - **Acceptance Criteria**:
     - [ ] Before starting a quality loop, query outcomes for the same agent + similar issue labels
     - [ ] Inject top 3 relevant lessons into agent system prompt
     - [ ] Lessons do not exceed 500 tokens total to avoid prompt bloat

6. **Session Resume Command**: Quickly load context from the last session
   - **User Story**: As a Developer, I want a "resume" command that loads my last session context so that I can pick up where I left off
   - **Acceptance Criteria**:
     - [ ] `agentx.resumeSession` command loads the most recent session for the current issue
     - [ ] Displays summary in Copilot Chat as a context message
     - [ ] If no session exists, informs the user

#### Could Have (P2)

7. **Session Timeline View**: Visual timeline of sessions in sidebar
   - **User Story**: As a Developer, I want to see a timeline of my sessions so that I can navigate my work history visually

#### Won't Have (Out of Scope)

- Cross-project knowledge sharing (deferred to Phase 2 -- Global Knowledge Base)
- Forgetting curve / memory decay (deferred to Phase 3)
- User expertise profiling (deferred to Phase 2)

### 4.2 AI/ML Requirements

#### Technology Classification

- [x] **Rule-based / statistical** -- no model needed (deterministic logic only)

Outcome tracking, session recording, confidence markers, and memory health are all deterministic operations. No LLM inference required for the core features. Outcome-informed prompts (P1) inject learned lessons into existing agent prompts but do not require additional model calls.

### 4.3 Non-Functional Requirements

#### Performance

- **Outcome query**: < 500ms for stores up to 1000 records
- **Session recording**: < 200ms per capture (runs during compaction)
- **Memory health scan**: < 2 seconds for stores up to 5000 observations
- **Prompt injection**: < 100ms to query and format relevant outcomes

#### Security

- All data stored locally in workspace `.agentx/memory/` directory
- No external API calls for any Phase 1 feature
- Memory health `--fix` operations are non-destructive by default (move to `.agentx/memory/.archive/`)

#### Reliability

- Session recorder MUST NOT block context compaction on failure -- catch and log errors
- Outcome tracker MUST NOT block quality loop completion on write failure
- Memory health MUST handle corrupt JSON gracefully (skip and report, do not crash)

---

## 5. User Stories & Features

### Feature 1: Outcome Tracker

**Description**: Records structured outcomes from quality loop executions to enable learning from past successes and failures.
**Priority**: P0
**Estimate**: 3 days

| Story ID | As a... | I want... | So that... | Priority |
|----------|---------|-----------|------------|----------|
| US-1.1 | Engineer | outcomes auto-recorded after each quality loop | the system learns from my work | P0 |
| US-1.2 | Engineer | to query past outcomes by keyword | I can find relevant lessons before starting similar work | P0 |
| US-1.3 | Engineer | top lessons injected into my agent prompt | I avoid repeating past mistakes | P1 |

### Feature 2: Episodic Memory (Session Recorder)

**Description**: Auto-captures session summaries during context compaction for continuity across sessions.
**Priority**: P0
**Estimate**: 3 days

| Story ID | As a... | I want... | So that... | Priority |
|----------|---------|-----------|------------|----------|
| US-2.1 | Developer | sessions auto-captured at compaction | I have a record of what happened | P0 |
| US-2.2 | Developer | to list recent sessions via command | I can browse my work history | P0 |
| US-2.3 | Developer | a "resume" command for the last session | I can pick up where I left off | P1 |
| US-2.4 | Developer | a visual session timeline in the sidebar | I can navigate sessions visually | P2 |

### Feature 3: Confidence Markers

**Description**: Agents signal uncertainty in their outputs using standardized confidence tags.
**Priority**: P0
**Estimate**: 1 day

| Story ID | As a... | I want... | So that... | Priority |
|----------|---------|-----------|------------|----------|
| US-3.1 | Reviewer | Architect ADRs to have confidence markers | I know which sections need deeper scrutiny | P0 |
| US-3.2 | Engineer | Reviewer feedback to have confidence markers | I can prioritize which feedback is firm vs. exploratory | P0 |

### Feature 4: Memory Health Command

**Description**: Validates and optionally repairs memory store integrity.
**Priority**: P0
**Estimate**: 2 days

| Story ID | As a... | I want... | So that... | Priority |
|----------|---------|-----------|------------|----------|
| US-4.1 | Developer | a health check command for my memory store | I know if my store is healthy | P0 |
| US-4.2 | Developer | auto-repair via `--fix` flag | orphaned/corrupt entries are cleaned up | P0 |

---

## 6. User Flows

### Primary Flow: Outcome Learning

**Trigger**: Engineer agent completes a quality loop
**Preconditions**: Quality loop executed at least one iteration

1. Quality loop reaches completion (all tests pass, coverage met, lint clean)
2. System extracts outcome record: agent, issue, actions, pass/fail, lessons
3. Outcome written to `.agentx/memory/outcomes/outcome-{agent}-{issue}-{timestamp}.json`
4. Manifest updated with outcome index entry
5. **Success**: Outcome persisted for future retrieval

**Alternative Flows**:
- **6a. Loop fails**: Outcome recorded with `result: "fail"`, root cause captured
- **6b. Write error**: Log warning, do not block loop completion

### Primary Flow: Session Resume

**Trigger**: User runs `agentx.resumeSession` command
**Preconditions**: At least one prior session recorded

1. User opens Copilot Chat or runs command
2. System loads most recent session for the active issue (or most recent overall)
3. Session summary displayed: what happened, decisions made, files changed
4. User continues work with full context
5. **Success**: User resumes without re-reading files

### Primary Flow: Memory Health Check

**Trigger**: User runs `agentx.memoryHealth` command

1. System scans `.agentx/memory/manifest.json`
2. Cross-references with actual files on disk
3. Identifies: orphaned files, missing entries, corrupt JSON, stale observations
4. Generates report: total observations, orphans, stale, disk size
5. If `--fix` flag: moves orphans to `.archive/`, rebuilds manifest from disk
6. **Success**: Report displayed, store integrity restored

---

## 7. Dependencies & Constraints

### Technical Dependencies

| Dependency | Type | Status | Impact if Unavailable |
|------------|------|--------|----------------------|
| Existing memory pipeline (`memory/types.ts`, `observationStore.ts`) | Internal | Available | HIGH -- foundation for all features |
| Context compactor (`contextCompactor.ts`) | Internal | Available | HIGH -- trigger point for session recording |
| Quality loop (`selfReviewLoop.ts`) | Internal | Available | HIGH -- trigger point for outcome recording |
| Agent prompt templates (`.github/agents/*.agent.md`) | Internal | Available | MEDIUM -- confidence marker injection |

### Technical Constraints

- MUST extend existing `IObservationStore` interface, not replace it
- MUST NOT introduce external dependencies (npm packages)
- MUST use the same JSON file-based storage pattern as existing observation pipeline
- Confidence markers are prompt-level guidance, not code enforcement

---

## 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Outcome records grow unbounded | Medium | Medium | Add max count per issue (100), oldest auto-archived |
| Session recording slows compaction | High | Low | Fire-and-forget async write, 200ms timeout |
| Confidence markers ignored by LLM | Medium | Medium | Include few-shot examples in prompt template |
| Memory health scan slow on large stores | Medium | Low | Stream processing, early exit on first N errors |

---

## 9. Timeline & Milestones

### Sprint 1: Core Infrastructure (Days 1-3)

**Goal**: Outcome tracker and session recorder operational

**Deliverables**:
- `outcomeTracker.ts` -- types, store, and query interface
- `sessionRecorder.ts` -- auto-capture at compaction, query interface
- Integration with `selfReviewLoop.ts` and `contextCompactor.ts`
- Unit tests for both modules (>= 80% coverage)

### Sprint 2: Commands & Confidence (Days 4-6)

**Goal**: User-facing commands and confidence markers

**Deliverables**:
- `agentx.memoryHealth` command with `--fix` flag
- `agentx.sessionHistory` command
- Confidence marker instructions in Architect and Reviewer agent prompts
- Unit tests for memory health module (>= 80% coverage)

### Sprint 3: Polish & Integration (Days 7-9)

**Goal**: Outcome-informed prompts and session resume

**Deliverables**:
- `agentx.resumeSession` command
- Outcome query integration into agentic loop pre-start
- End-to-end testing of all flows
- Documentation updates

**Target Version**: v7.4.0

---

## 10. Out of Scope

- **Global Knowledge Base** -- cross-workspace memory (Phase 2)
- **Expertise Model** -- per-user skill calibration (Phase 2)
- **Model-Task Mapping** -- task complexity routing (Phase 2)
- **Forgetting Curve** -- memory decay by age/relevance (Phase 3)
- **MCP Server** -- external memory access (Phase 3)
- **Background Intelligence** -- proactive monitoring (Phase 3)
- **Synapse Network** -- observation inter-linking (Phase 3)

---

## 11. Open Questions

| Question | Owner | Status | Resolution |
|----------|-------|--------|------------|
| Should outcome records include full test output or just summary? | Architect | Open | Recommend summary only to limit storage |
| Should session recorder trigger on every compaction or only end-of-conversation? | Architect | Open | Recommend end-of-conversation only |
| Should confidence markers be 3-level (H/M/L) or 5-level? | PM | Resolved | 3-level for simplicity |
| Should memory health run automatically on extension activation? | Engineer | Open | Recommend manual-only for v7.4.0 |

---

## 12. Appendix

### Related Documents

- [Comparison Report: AgentX vs Alex](../COMPARISON-REPORT-Alex-vs-AgentX.md) -- source of adoptable concepts
- [Memory Pipeline Types](../../vscode-extension/src/memory/types.ts) -- existing memory data model
- [SPEC-Phase1-Cognitive-Foundation.md](../specs/SPEC-Phase1-Cognitive-Foundation.md) -- technical specification

### Glossary

- **Outcome Record**: Structured data capturing the result of a quality loop execution (agent, issue, pass/fail, lesson)
- **Episodic Memory**: Timestamped session summaries capturing what happened, decisions made, and files changed
- **Confidence Marker**: A standardized tag (`[Confidence: HIGH/MEDIUM/LOW]`) in agent output indicating certainty level
- **Memory Health**: The integrity state of the `.agentx/memory/` store (no orphans, no corruption, no excessive staleness)

---

**Generated by AgentX Product Manager Agent**
**Last Updated**: 2026-03-04
**Version**: 1.0
