import { strict as assert } from 'assert';
import { withRetry, calculateDelay, RetryConfig } from '../../utils/retryWithBackoff';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeError(status?: number, message?: string): Error & { status?: number } {
  const err: Error & { status?: number } = new Error(
    message ?? (status !== undefined ? `Request failed with status code ${status}` : 'Generic error'),
  );
  if (status !== undefined) {
    err.status = status;
  }
  return err;
}

/** Fast retry config for tests (tiny delays to keep suite fast). */
const FAST_CONFIG: Partial<RetryConfig> = {
  baseDelayMs: 1,
  maxDelayMs: 2,
  jitterPercent: 0,
  maxRetries: 3,
};

// ---------------------------------------------------------------------------
// calculateDelay
// ---------------------------------------------------------------------------

describe('calculateDelay', () => {
  const cfg: RetryConfig = {
    maxRetries: 5,
    baseDelayMs: 1_000,
    maxDelayMs: 32_000,
    multiplier: 2,
    jitterPercent: 0,
    retryableStatuses: [429, 500],
  };

  it('attempt 1 returns approximately baseDelayMs', () => {
    const d = calculateDelay(1, cfg);
    assert.ok(d >= 900 && d <= 1100, `Expected ~1000ms, got ${d}`);
  });

  it('attempt 2 returns approximately base * multiplier', () => {
    const d = calculateDelay(2, cfg);
    assert.ok(d >= 1800 && d <= 2200, `Expected ~2000ms, got ${d}`);
  });

  it('attempt 3 doubles again', () => {
    const d = calculateDelay(3, cfg);
    assert.ok(d >= 3600 && d <= 4400, `Expected ~4000ms, got ${d}`);
  });

  it('caps at maxDelayMs', () => {
    const cappedCfg = { ...cfg, maxDelayMs: 5_000 };
    const d = calculateDelay(10, cappedCfg);
    assert.ok(d <= 5_000 * 1.25, `Expected to be capped near 5000ms, got ${d}`);
  });

  it('jitter stays within jitterPercent range', () => {
    const jitterCfg = { ...cfg, jitterPercent: 0.2 };
    for (let i = 0; i < 50; i++) {
      const d = calculateDelay(1, jitterCfg);
      assert.ok(d >= 800, `Delay ${d} is below lower jitter bound`);
      assert.ok(d <= 1200, `Delay ${d} is above upper jitter bound`);
    }
  });

  it('always returns at least 1ms', () => {
    const nearZeroCfg = { ...cfg, baseDelayMs: 0 };
    const d = calculateDelay(1, nearZeroCfg);
    assert.ok(d >= 1);
  });
});

// ---------------------------------------------------------------------------
// withRetry -- success on first attempt
// ---------------------------------------------------------------------------

describe('withRetry -- success on first attempt', () => {
  it('returns value immediately when fn succeeds', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      return 'success';
    }, FAST_CONFIG);

    assert.equal(result, 'success');
    assert.equal(calls, 1);
  });

  it('does not call log when fn succeeds immediately', async () => {
    const logs: string[] = [];
    await withRetry(async () => 42, FAST_CONFIG, (msg) => logs.push(msg));
    assert.equal(logs.length, 0);
  });
});

// ---------------------------------------------------------------------------
// withRetry -- retry on transient errors
// ---------------------------------------------------------------------------

describe('withRetry -- retry on transient errors', () => {
  it('retries on HTTP 429 and eventually succeeds', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls < 3) { throw makeError(429); }
      return 'ok';
    }, FAST_CONFIG);

    assert.equal(result, 'ok');
    assert.equal(calls, 3);
  });

  it('retries on HTTP 500', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls === 1) { throw makeError(500); }
      return 'recovered';
    }, FAST_CONFIG);

    assert.equal(result, 'recovered');
    assert.equal(calls, 2);
  });

  it('retries on HTTP 502', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls === 1) { throw makeError(502); }
      return 'ok';
    }, FAST_CONFIG);
    assert.equal(result, 'ok');
    assert.equal(calls, 2);
  });

  it('retries on HTTP 503', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls === 1) { throw makeError(503); }
      return 'ok';
    }, FAST_CONFIG);
    assert.equal(result, 'ok');
    assert.equal(calls, 2);
  });

  it('retries on network timeout (ETIMEDOUT)', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls === 1) {
        const err: Error & { code?: string } = new Error('connect ETIMEDOUT');
        err.code = 'ETIMEDOUT';
        throw err;
      }
      return 'connected';
    }, FAST_CONFIG);
    assert.equal(result, 'connected');
    assert.equal(calls, 2);
  });

  it('retries on ECONNRESET', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls === 1) {
        const err: Error & { code?: string } = new Error('read ECONNRESET');
        err.code = 'ECONNRESET';
        throw err;
      }
      return 'ok';
    }, FAST_CONFIG);
    assert.equal(result, 'ok');
    assert.equal(calls, 2);
  });

  it('retries on message containing "timeout"', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls === 1) { throw new Error('Request timed out after 30s'); }
      return 'done';
    }, FAST_CONFIG);
    assert.equal(result, 'done');
    assert.equal(calls, 2);
  });
});

// ---------------------------------------------------------------------------
// withRetry -- do NOT retry on non-transient errors
// ---------------------------------------------------------------------------

describe('withRetry -- non-retryable errors', () => {
  it('throws immediately on HTTP 400', async () => {
    let calls = 0;
    await assert.rejects(
      async () => {
        await withRetry(async () => {
          calls++;
          throw makeError(400);
        }, FAST_CONFIG);
      },
      /400/,
    );
    assert.equal(calls, 1, 'Should not retry on 400');
  });

  it('throws immediately on HTTP 401', async () => {
    let calls = 0;
    await assert.rejects(
      async () => {
        await withRetry(async () => {
          calls++;
          throw makeError(401);
        }, FAST_CONFIG);
      },
    );
    assert.equal(calls, 1, 'Should not retry on 401');
  });

  it('throws immediately on HTTP 403', async () => {
    let calls = 0;
    await assert.rejects(
      async () => {
        await withRetry(async () => {
          calls++;
          throw makeError(403);
        }, FAST_CONFIG);
      },
    );
    assert.equal(calls, 1, 'Should not retry on 403');
  });

  it('throws immediately on HTTP 404', async () => {
    let calls = 0;
    await assert.rejects(
      async () => {
        await withRetry(async () => {
          calls++;
          throw makeError(404);
        }, FAST_CONFIG);
      },
    );
    assert.equal(calls, 1, 'Should not retry on 404');
  });

  it('throws immediately on non-HTTP, non-network errors', async () => {
    let calls = 0;
    await assert.rejects(
      async () => {
        await withRetry(async () => {
          calls++;
          throw new Error('SyntaxError: unexpected token');
        }, FAST_CONFIG);
      },
      /SyntaxError/,
    );
    assert.equal(calls, 1);
  });
});

// ---------------------------------------------------------------------------
// withRetry -- exhausted retries
// ---------------------------------------------------------------------------

describe('withRetry -- exhausted retries', () => {
  it('throws after maxRetries is exhausted', async () => {
    let calls = 0;
    const cfg = { ...FAST_CONFIG, maxRetries: 2 };
    await assert.rejects(
      async () => {
        await withRetry(async () => {
          calls++;
          throw makeError(500);
        }, cfg);
      },
    );
    // 1 initial + 2 retries = 3 total calls
    assert.equal(calls, 3, `Expected 3 total calls (1 initial + 2 retries), got ${calls}`);
  });

  it('re-throws the last error', async () => {
    const lastErr = makeError(429, 'Rate limited');
    await assert.rejects(
      () => withRetry(async () => { throw lastErr; }, { ...FAST_CONFIG, maxRetries: 1 }),
      (err) => err === lastErr,
    );
  });
});

// ---------------------------------------------------------------------------
// withRetry -- logging
// ---------------------------------------------------------------------------

describe('withRetry -- logging', () => {
  it('calls log on each retry attempt', async () => {
    const logs: string[] = [];
    let calls = 0;
    await withRetry(
      async () => {
        calls++;
        if (calls < 3) { throw makeError(429); }
        return 'ok';
      },
      FAST_CONFIG,
      (msg) => logs.push(msg),
    );

    assert.equal(logs.length, 2, 'Should log 2 retry attempts');
    assert.ok(logs[0].includes('Attempt 1'), `log[0]: ${logs[0]}`);
    assert.ok(logs[1].includes('Attempt 2'), `log[1]: ${logs[1]}`);
  });

  it('includes HTTP status in log message', async () => {
    const logs: string[] = [];
    let calls = 0;
    await withRetry(
      async () => {
        calls++;
        if (calls === 1) { throw makeError(429); }
        return 'done';
      },
      FAST_CONFIG,
      (msg) => logs.push(msg),
    );
    assert.ok(logs[0].includes('429'), `Expected status 429 in log, got: ${logs[0]}`);
  });

  it('does not log on success without retries', async () => {
    const logs: string[] = [];
    await withRetry(async () => 'direct', FAST_CONFIG, (msg) => logs.push(msg));
    assert.equal(logs.length, 0);
  });
});

// ---------------------------------------------------------------------------
// withRetry -- default config
// ---------------------------------------------------------------------------

describe('withRetry -- default config', () => {
  it('works with no config argument', async () => {
    // Just verify it resolves -- we can not afford to wait 32s for retries
    const result = await withRetry(async () => 'default config test');
    assert.equal(result, 'default config test');
  });

  it('works with no log argument', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls === 1) { throw makeError(500); }
      return 'no log';
    }, FAST_CONFIG);
    assert.equal(result, 'no log');
  });
});

// ---------------------------------------------------------------------------
// withRetry -- partial config override
// ---------------------------------------------------------------------------

describe('withRetry -- partial config override', () => {
  it('allows overriding only maxRetries', async () => {
    let calls = 0;
    await assert.rejects(
      () => withRetry(
        async () => { calls++; throw makeError(500); },
        { ...FAST_CONFIG, maxRetries: 1 },
      ),
    );
    assert.equal(calls, 2); // 1 initial + 1 retry
  });

  it('allows custom retryableStatuses', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls === 1) { throw makeError(418); } // I'm a teapot
        return 'done';
      },
      { ...FAST_CONFIG, retryableStatuses: [418] },
    );
    assert.equal(result, 'done');
    assert.equal(calls, 2);
  });
});
