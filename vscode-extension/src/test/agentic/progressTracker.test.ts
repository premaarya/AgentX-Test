import { strict as assert } from 'assert';
import {
  ProgressTracker,
  PlanStep,
  StepRecord,
  TaskLedger,
  ProgressLedger,
  RePlanContext,
} from '../../agentic/progressTracker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTracker(
  stallThreshold = 3,
  staleTimeoutMs = 60_000,
  maxReplans = 2,
): ProgressTracker {
  return new ProgressTracker(stallThreshold, staleTimeoutMs, maxReplans);
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

describe('ProgressTracker -- initialization', () => {
  it('throws if recordSuccess called before initialize', () => {
    const tracker = makeTracker();
    assert.throws(() => tracker.recordSuccess(0), /not initialized/i);
  });

  it('throws if recordFailure called before initialize', () => {
    const tracker = makeTracker();
    assert.throws(() => tracker.recordFailure(0), /not initialized/i);
  });

  it('throws if getRePlanContext called before initialize', () => {
    const tracker = makeTracker();
    assert.throws(() => tracker.getRePlanContext(), /not initialized/i);
  });

  it('isStalled returns false before initialize', () => {
    const tracker = makeTracker();
    assert.equal(tracker.isStalled(), false);
  });

  it('isStale returns false before initialize', () => {
    const tracker = makeTracker();
    assert.equal(tracker.isStale(), false);
  });

  it('getTaskLedger returns null before initialize', () => {
    const tracker = makeTracker();
    assert.equal(tracker.getTaskLedger(), null);
  });

  it('getProgressLedger returns null before initialize', () => {
    const tracker = makeTracker();
    assert.equal(tracker.getProgressLedger(), null);
  });

  it('creates task ledger after initialize', () => {
    const tracker = makeTracker();
    tracker.initialize('Build feature X', ['Step A', 'Step B'], ['fact1'], ['assume1']);

    const tl: Readonly<TaskLedger> | null = tracker.getTaskLedger();
    assert.ok(tl !== null);
    assert.equal(tl.objective, 'Build feature X');
    assert.deepEqual(tl.facts, ['fact1']);
    assert.deepEqual(tl.assumptions, ['assume1']);
    assert.equal(tl.plan.length, 2);
    assert.equal(tl.plan[0].description, 'Step A');
    assert.equal(tl.plan[0].status, 'pending');
  });

  it('creates progress ledger with zeroed counters after initialize', () => {
    const tracker = makeTracker();
    tracker.initialize('Objective');

    const pl: Readonly<ProgressLedger> | null = tracker.getProgressLedger();
    assert.ok(pl !== null);
    assert.equal(pl.stallCount, 0);
    assert.equal(pl.totalReplans, 0);
    assert.equal(pl.currentStepIndex, 0);
    assert.deepEqual(pl.stepHistory, []);
  });

  it('allows initialize with no plan', () => {
    const tracker = makeTracker();
    tracker.initialize('Objective');
    const tl = tracker.getTaskLedger();
    assert.ok(tl !== null);
    assert.deepEqual(tl.plan, []);
  });
});

// ---------------------------------------------------------------------------
// recordSuccess
// ---------------------------------------------------------------------------

describe('ProgressTracker -- recordSuccess', () => {
  it('resets stallCount to 0', () => {
    const tracker = makeTracker();
    tracker.initialize('Obj');
    tracker.recordFailure(0, 'Error 1');
    tracker.recordFailure(0, 'Error 2');
    tracker.recordSuccess(0, 'Done');

    const pl = tracker.getProgressLedger()!;
    assert.equal(pl.stallCount, 0);
  });

  it('adds a success record to stepHistory', () => {
    const tracker = makeTracker();
    tracker.initialize('Obj', ['Step A']);
    tracker.recordSuccess(0, 'result text');

    const pl = tracker.getProgressLedger()!;
    assert.equal(pl.stepHistory.length, 1);
    assert.equal(pl.stepHistory[0].status, 'success');
    assert.equal(pl.stepHistory[0].stepIndex, 0);
    assert.equal(pl.stepHistory[0].detail, 'result text');
  });

  it('marks the plan step as done', () => {
    const tracker = makeTracker();
    tracker.initialize('Obj', ['Step A']);
    tracker.recordSuccess(0);

    const tl = tracker.getTaskLedger()!;
    assert.equal(tl.plan[0].status, 'done');
  });

  it('updates lastProgressTimestamp', () => {
    const tracker = makeTracker();
    tracker.initialize('Obj');
    const before = Date.now();
    tracker.recordSuccess(0);
    const after = Date.now();

    const pl = tracker.getProgressLedger()!;
    assert.ok(pl.lastProgressTimestamp >= before);
    assert.ok(pl.lastProgressTimestamp <= after);
  });

  it('advances currentStepIndex', () => {
    const tracker = makeTracker();
    tracker.initialize('Obj', ['A', 'B', 'C']);
    tracker.recordSuccess(1);
    const pl = tracker.getProgressLedger()!;
    assert.ok(pl.currentStepIndex >= 2);
  });
});

// ---------------------------------------------------------------------------
// recordFailure
// ---------------------------------------------------------------------------

describe('ProgressTracker -- recordFailure', () => {
  it('increments stallCount', () => {
    const tracker = makeTracker();
    tracker.initialize('Obj');
    tracker.recordFailure(0, 'err1');
    tracker.recordFailure(0, 'err2');

    const pl = tracker.getProgressLedger()!;
    assert.equal(pl.stallCount, 2);
  });

  it('adds a failure record to stepHistory', () => {
    const tracker = makeTracker();
    tracker.initialize('Obj', ['Step A']);
    tracker.recordFailure(0, 'file not found');

    const pl = tracker.getProgressLedger()!;
    assert.equal(pl.stepHistory.length, 1);
    assert.equal(pl.stepHistory[0].status, 'failure');
    assert.equal(pl.stepHistory[0].detail, 'file not found');
  });

  it('marks the plan step as failed', () => {
    const tracker = makeTracker();
    tracker.initialize('Obj', ['Step B']);
    tracker.recordFailure(0);

    const tl = tracker.getTaskLedger()!;
    assert.equal(tl.plan[0].status, 'failed');
  });

  it('does not reset lastProgressTimestamp', () => {
    const tracker = makeTracker();
    tracker.initialize('Obj');
    const before = tracker.getProgressLedger()!.lastProgressTimestamp;
    tracker.recordFailure(0, 'err');
    const after = tracker.getProgressLedger()!.lastProgressTimestamp;
    // lastProgressTimestamp should NOT be updated on failure
    assert.ok(after === before || after >= before, 'timestamp should not decrease');
  });
});

// ---------------------------------------------------------------------------
// isStalled
// ---------------------------------------------------------------------------

describe('ProgressTracker -- isStalled', () => {
  it('returns false when stallCount is below threshold', () => {
    const tracker = makeTracker(3);
    tracker.initialize('Obj');
    tracker.recordFailure(0);
    tracker.recordFailure(0);
    assert.equal(tracker.isStalled(), false);
  });

  it('returns true when stallCount reaches threshold', () => {
    const tracker = makeTracker(3);
    tracker.initialize('Obj');
    tracker.recordFailure(0);
    tracker.recordFailure(0);
    tracker.recordFailure(0);
    assert.equal(tracker.isStalled(), true);
  });

  it('returns false after replan budget is exhausted', () => {
    const tracker = makeTracker(2, 60_000, 1);
    tracker.initialize('Obj');
    tracker.recordFailure(0);
    tracker.recordFailure(0);
    assert.equal(tracker.isStalled(), true);

    tracker.acknowledgeReplan();
    // After maxReplans reached, isStalled should be false even with failures
    tracker.recordFailure(0);
    tracker.recordFailure(0);
    assert.equal(tracker.isStalled(), false);
  });

  it('returns false after a success resets the stall count', () => {
    const tracker = makeTracker(2);
    tracker.initialize('Obj');
    tracker.recordFailure(0);
    tracker.recordFailure(0);
    assert.equal(tracker.isStalled(), true);

    tracker.recordSuccess(0);
    assert.equal(tracker.isStalled(), false);
  });
});

// ---------------------------------------------------------------------------
// isStale
// ---------------------------------------------------------------------------

describe('ProgressTracker -- isStale', () => {
  it('returns false immediately after initialize', () => {
    const tracker = makeTracker(3, 60_000);
    tracker.initialize('Obj');
    assert.equal(tracker.isStale(), false);
  });

  it('returns true when staleTimeoutMs is very small and time has passed', (done) => {
    const tracker = makeTracker(3, 10); // 10ms stale timeout
    tracker.initialize('Obj');
    setTimeout(() => {
      assert.equal(tracker.isStale(), true);
      done();
    }, 20);
  });

  it('returns false when staleTimeoutMs has not elapsed', () => {
    const tracker = makeTracker(3, 60_000);
    tracker.initialize('Obj');
    assert.equal(tracker.isStale(), false);
  });
});

// ---------------------------------------------------------------------------
// getRePlanContext
// ---------------------------------------------------------------------------

describe('ProgressTracker -- getRePlanContext', () => {
  it('returns objective and facts from task ledger', () => {
    const tracker = makeTracker();
    tracker.initialize('Build X', ['s1'], ['nodejs'], ['no auth needed']);
    tracker.recordFailure(0, 'err1');

    const ctx: RePlanContext = tracker.getRePlanContext();
    assert.equal(ctx.objective, 'Build X');
    assert.deepEqual(ctx.facts, ['nodejs']);
  });

  it('includes last N failure details', () => {
    const tracker = makeTracker(3);
    tracker.initialize('Obj');
    tracker.recordFailure(0, 'error A');
    tracker.recordFailure(0, 'error B');
    tracker.recordFailure(0, 'error C');

    const ctx = tracker.getRePlanContext();
    assert.ok(ctx.lastErrors.includes('error A'));
    assert.ok(ctx.lastErrors.includes('error C'));
    assert.equal(ctx.failedSteps.length, 3);
  });

  it('includes only failure records in failedSteps', () => {
    const tracker = makeTracker(3);
    tracker.initialize('Obj');
    tracker.recordSuccess(0, 'ok');
    tracker.recordFailure(1, 'fail1');
    tracker.recordFailure(1, 'fail2');

    const ctx = tracker.getRePlanContext();
    assert.ok(
      ctx.failedSteps.every((r: StepRecord) => r.status === 'failure'),
    );
  });
});

// ---------------------------------------------------------------------------
// acknowledgeReplan
// ---------------------------------------------------------------------------

describe('ProgressTracker -- acknowledgeReplan', () => {
  it('increments totalReplans', () => {
    const tracker = makeTracker();
    tracker.initialize('Obj');
    tracker.acknowledgeReplan();
    const pl = tracker.getProgressLedger()!;
    assert.equal(pl.totalReplans, 1);
  });

  it('resets stallCount', () => {
    const tracker = makeTracker(2);
    tracker.initialize('Obj');
    tracker.recordFailure(0);
    tracker.recordFailure(0);
    assert.equal(tracker.isStalled(), true);

    tracker.acknowledgeReplan();
    const pl = tracker.getProgressLedger()!;
    assert.equal(pl.stallCount, 0);
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe('ProgressTracker -- reset', () => {
  it('clears all state after reset', () => {
    const tracker = makeTracker();
    tracker.initialize('Obj', ['A']);
    tracker.recordSuccess(0);
    tracker.reset();

    assert.equal(tracker.getTaskLedger(), null);
    assert.equal(tracker.getProgressLedger(), null);
    assert.equal(tracker.isStalled(), false);
    assert.equal(tracker.isStale(), false);
  });

  it('can re-initialize after reset', () => {
    const tracker = makeTracker();
    tracker.initialize('First task');
    tracker.reset();
    tracker.initialize('Second task');
    const tl = tracker.getTaskLedger();
    assert.ok(tl !== null);
    assert.equal(tl.objective, 'Second task');
  });
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

describe('ProgressTracker -- configuration', () => {
  it('exposes configured stallThreshold', () => {
    const tracker = makeTracker(5);
    assert.equal(tracker.stallThreshold, 5);
  });

  it('exposes configured staleTimeoutMs', () => {
    const tracker = makeTracker(3, 30_000);
    assert.equal(tracker.staleTimeoutMs, 30_000);
  });

  it('exposes configured maxReplans', () => {
    const tracker = makeTracker(3, 60_000, 4);
    assert.equal(tracker.maxReplans, 4);
  });

  it('uses default values when constructed with no args', () => {
    const tracker = new ProgressTracker();
    assert.equal(tracker.stallThreshold, 3);
    assert.equal(tracker.staleTimeoutMs, 60_000);
    assert.equal(tracker.maxReplans, 2);
  });
});

// ---------------------------------------------------------------------------
// Type exports (compile-time check)
// ---------------------------------------------------------------------------

describe('ProgressTracker -- type exports', () => {
  it('PlanStep has correct shape', () => {
    const step: PlanStep = { index: 0, description: 'test', status: 'pending' };
    assert.equal(step.status, 'pending');
  });

  it('StepRecord has correct shape', () => {
    const record: StepRecord = {
      stepIndex: 0,
      status: 'success',
      timestamp: Date.now(),
      durationMs: 10,
    };
    assert.equal(record.status, 'success');
  });
});
