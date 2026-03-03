// ---------------------------------------------------------------------------
// AgentX -- Dual-Ledger Progress Tracker
// ---------------------------------------------------------------------------
//
// Implements a two-ledger system for tracking agentic loop progress:
//
//   TaskLedger   -- immutable goal + plan (what needs to be done)
//   ProgressLedger -- mutable record of execution history (what happened)
//
// Provides stall detection (consecutive failures >= stallThreshold) and
// stale detection (no progress for staleTimeoutMs). When stalled, the
// caller should request a replan from the LLM using getRePlanContext().
//
// maxReplans guards against infinite replanning loops.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single step in the agent's plan.
 */
export interface PlanStep {
  readonly index: number;
  readonly description: string;
  status: 'pending' | 'active' | 'done' | 'failed';
}

/**
 * A historical record of a single step execution attempt.
 */
export interface StepRecord {
  readonly stepIndex: number;
  readonly status: 'success' | 'failure';
  readonly timestamp: number;
  readonly detail?: string;
  readonly durationMs: number;
}

/**
 * The task ledger: records the objective and plan.
 * Updated when a replan is triggered.
 */
export interface TaskLedger {
  readonly objective: string;
  readonly facts: readonly string[];
  readonly assumptions: readonly string[];
  plan: PlanStep[];
  readonly createdAt: string;
  updatedAt: string;
}

/**
 * The progress ledger: tracks execution state.
 * Mutated on every recordSuccess / recordFailure call.
 */
export interface ProgressLedger {
  currentStepIndex: number;
  stepHistory: StepRecord[];
  stallCount: number;
  lastProgressTimestamp: number;
  totalReplans: number;
}

/**
 * Context passed to the LLM when requesting a replan.
 * Contains objective, known facts, and the last N errors.
 */
export interface RePlanContext {
  readonly objective: string;
  readonly facts: readonly string[];
  readonly lastErrors: readonly string[];
  readonly failedSteps: readonly StepRecord[];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_STALL_THRESHOLD = 3;
const DEFAULT_STALE_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_REPLANS = 2;

// ---------------------------------------------------------------------------
// ProgressTracker
// ---------------------------------------------------------------------------

/**
 * Dual-ledger progress tracker for the agentic loop.
 *
 * Usage:
 * ```typescript
 * const tracker = new ProgressTracker();
 * tracker.initialize('Implement feature X', ['Read spec', 'Write code', 'Write tests']);
 *
 * // After each tool execution:
 * tracker.recordSuccess(0, 'Spec read successfully');
 *
 * // After failures:
 * tracker.recordFailure(1, 'File not found');
 * if (tracker.isStalled()) {
 *   const ctx = tracker.getRePlanContext();
 *   // Send ctx to LLM for replan
 *   tracker.acknowledgeReplan();
 * }
 * ```
 */
export class ProgressTracker {
  private taskLedger: TaskLedger | null = null;
  private progressLedger: ProgressLedger | null = null;
  private stepStartTimes = new Map<number, number>();

  readonly stallThreshold: number;
  readonly staleTimeoutMs: number;
  readonly maxReplans: number;

  constructor(
    stallThreshold = DEFAULT_STALL_THRESHOLD,
    staleTimeoutMs = DEFAULT_STALE_TIMEOUT_MS,
    maxReplans = DEFAULT_MAX_REPLANS,
  ) {
    this.stallThreshold = stallThreshold;
    this.staleTimeoutMs = staleTimeoutMs;
    this.maxReplans = maxReplans;
  }

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  /**
   * Initialize the tracker for a new task.
   *
   * @param objective - The high-level goal of the agentic task
   * @param plan - Ordered list of step descriptions
   * @param facts - Known facts about the task context
   * @param assumptions - Assumptions being made
   */
  initialize(
    objective: string,
    plan: string[] = [],
    facts: string[] = [],
    assumptions: string[] = [],
  ): void {
    const now = new Date().toISOString();
    this.taskLedger = {
      objective,
      facts,
      assumptions,
      plan: plan.map((description, index) => ({
        index,
        description,
        status: 'pending' as const,
      })),
      createdAt: now,
      updatedAt: now,
    };
    this.progressLedger = {
      currentStepIndex: 0,
      stepHistory: [],
      stallCount: 0,
      lastProgressTimestamp: Date.now(),
      totalReplans: 0,
    };
    this.stepStartTimes.clear();
  }

  // -----------------------------------------------------------------------
  // Recording
  // -----------------------------------------------------------------------

  /**
   * Record a successful step execution. Resets the stall counter.
   *
   * @param stepIndex - The step (or tool call index) that succeeded
   * @param detail - Optional description of the result
   */
  recordSuccess(stepIndex: number, detail?: string): void {
    this.ensureInitialized();

    const startTime = this.stepStartTimes.get(stepIndex) ?? Date.now();
    const durationMs = Date.now() - startTime;

    const record: StepRecord = {
      stepIndex,
      status: 'success',
      timestamp: Date.now(),
      detail,
      durationMs,
    };

    this.progressLedger!.stepHistory.push(record);
    this.progressLedger!.stallCount = 0;
    this.progressLedger!.lastProgressTimestamp = Date.now();
    this.progressLedger!.currentStepIndex = Math.max(
      this.progressLedger!.currentStepIndex,
      stepIndex + 1,
    );

    const step = this.taskLedger!.plan[stepIndex];
    if (step) {
      step.status = 'done';
    }

    this.stepStartTimes.delete(stepIndex);
    this.taskLedger!.updatedAt = new Date().toISOString();
  }

  /**
   * Record a failed step execution. Increments the stall counter.
   *
   * @param stepIndex - The step (or tool call index) that failed
   * @param detail - Optional error message or description
   */
  recordFailure(stepIndex: number, detail?: string): void {
    this.ensureInitialized();

    const startTime = this.stepStartTimes.get(stepIndex) ?? Date.now();
    const durationMs = Date.now() - startTime;

    const record: StepRecord = {
      stepIndex,
      status: 'failure',
      timestamp: Date.now(),
      detail,
      durationMs,
    };

    this.progressLedger!.stepHistory.push(record);
    this.progressLedger!.stallCount++;

    const step = this.taskLedger!.plan[stepIndex];
    if (step) {
      step.status = 'failed';
    }

    this.stepStartTimes.delete(stepIndex);
    this.taskLedger!.updatedAt = new Date().toISOString();
  }

  // -----------------------------------------------------------------------
  // State Detection
  // -----------------------------------------------------------------------

  /**
   * Returns true if consecutive failures have reached the stall threshold
   * AND we have not yet exhausted the replan budget.
   */
  isStalled(): boolean {
    if (!this.progressLedger) { return false; }
    return (
      this.progressLedger.stallCount >= this.stallThreshold
      && this.progressLedger.totalReplans < this.maxReplans
    );
  }

  /**
   * Returns true if no progress has been made within staleTimeoutMs.
   * Used to emit a warning to the user without interrupting the loop.
   */
  isStale(): boolean {
    if (!this.progressLedger) { return false; }
    return Date.now() - this.progressLedger.lastProgressTimestamp >= this.staleTimeoutMs;
  }

  // -----------------------------------------------------------------------
  // Replan Support
  // -----------------------------------------------------------------------

  /**
   * Returns a context object for the LLM replan request.
   * Includes objective, known facts, and the last N failure records.
   */
  getRePlanContext(): RePlanContext {
    this.ensureInitialized();

    const failures = this.progressLedger!.stepHistory
      .filter((r) => r.status === 'failure')
      .slice(-this.stallThreshold);

    return {
      objective: this.taskLedger!.objective,
      facts: [...this.taskLedger!.facts],
      lastErrors: failures.map((f) => f.detail ?? 'Unknown error'),
      failedSteps: failures,
    };
  }

  /**
   * Acknowledge that a replan has been requested.
   * Increments totalReplans and resets the stall counter.
   * Call this after sending the replan context to the LLM.
   */
  acknowledgeReplan(): void {
    this.ensureInitialized();
    this.progressLedger!.totalReplans++;
    this.progressLedger!.stallCount = 0;
    this.taskLedger!.updatedAt = new Date().toISOString();
  }

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  /**
   * Reset all ledger state. Call between separate task executions.
   */
  reset(): void {
    this.taskLedger = null;
    this.progressLedger = null;
    this.stepStartTimes.clear();
  }

  // -----------------------------------------------------------------------
  // Accessors (read-only views)
  // -----------------------------------------------------------------------

  /** Returns a read-only view of the task ledger, or null if not initialized. */
  getTaskLedger(): Readonly<TaskLedger> | null {
    return this.taskLedger;
  }

  /** Returns a read-only view of the progress ledger, or null if not initialized. */
  getProgressLedger(): Readonly<ProgressLedger> | null {
    return this.progressLedger;
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private ensureInitialized(): void {
    if (!this.taskLedger || !this.progressLedger) {
      throw new Error('ProgressTracker not initialized. Call initialize() first.');
    }
  }
}
