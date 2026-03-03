// ---------------------------------------------------------------------------
// AgentX -- Retry with Exponential Backoff
// ---------------------------------------------------------------------------
//
// Generic retry utility for LLM API calls and other async operations.
//
// Features:
//   - Exponential backoff: delay = min(base * multiplier^(attempt-1), max)
//   - Jitter: +/- jitterPercent applied to each delay to prevent thundering herd
//   - Configurable retryable HTTP status codes (429, 500, 502, 503 by default)
//   - Network timeout errors (ETIMEDOUT, ECONNRESET, ENOTFOUND) are retried
//   - Non-transient errors (400, 401, 403, 404) are thrown immediately
//   - Per-attempt log callback for observability
//
// Delay progression (defaults): 1s, 2s, 4s, 8s, 16s (capped at 32s)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for the retry logic.
 * All fields have sensible defaults and can be overridden partially.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (not counting the initial attempt). */
  readonly maxRetries: number;
  /** Base delay in ms for the first retry. */
  readonly baseDelayMs: number;
  /** Maximum delay cap in ms. */
  readonly maxDelayMs: number;
  /** Multiplication factor per retry attempt. Default 2 = exponential doubling. */
  readonly multiplier: number;
  /**
   * Fraction of the computed delay added/subtracted as random jitter.
   * 0.2 means the actual delay is in the range [delay*0.8, delay*1.2].
   */
  readonly jitterPercent: number;
  /** HTTP status codes that are considered transient and worth retrying. */
  readonly retryableStatuses: readonly number[];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 32_000,
  multiplier: 2,
  jitterPercent: 0.2,
  retryableStatuses: [429, 500, 502, 503],
};

/**
 * HTTP status codes that represent permanent, non-transient errors.
 * These are NEVER retried.
 */
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404]);

// ---------------------------------------------------------------------------
// Error classification helpers
// ---------------------------------------------------------------------------

/**
 * Extract an HTTP status code from an error object.
 * Handles common error shapes: { status }, { statusCode }, { code (number) },
 * or a status code embedded in the error message string.
 */
function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') { return null; }

  const e = error as Record<string, unknown>;

  if (typeof e.status === 'number') { return e.status; }
  if (typeof e.statusCode === 'number') { return e.statusCode; }
  if (typeof e.code === 'number') { return e.code; }

  // Try to extract from message string (e.g. "Request failed with status code 429")
  const msg = typeof e.message === 'string' ? e.message : '';
  const statusInMsg = msg.match(/\b(400|401|403|404|429|500|502|503)\b/);
  if (statusInMsg) {
    return parseInt(statusInMsg[1], 10);
  }

  return null;
}

/**
 * Returns true if the error looks like a network timeout or connectivity error.
 */
function isNetworkTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') { return false; }

  const e = error as Record<string, unknown>;
  const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  const code = typeof e.code === 'string' ? e.code.toUpperCase() : '';

  return (
    msg.includes('timeout')
    || msg.includes('timed out')
    || msg.includes('econnreset')
    || msg.includes('network error')
    || msg.includes('connection refused')
    || code === 'ETIMEDOUT'
    || code === 'ECONNRESET'
    || code === 'ENOTFOUND'
    || code === 'ECONNREFUSED'
  );
}

/**
 * Determine whether the error is transient and worth retrying.
 */
function isRetryable(error: unknown, config: RetryConfig): boolean {
  const status = getErrorStatus(error);

  if (status !== null) {
    // Explicitly non-retryable? Bail immediately.
    if (NON_RETRYABLE_STATUSES.has(status)) { return false; }
    // Explicitly retryable status? Yes.
    return config.retryableStatuses.includes(status);
  }

  // No HTTP status found -- check for network-level transient errors
  return isNetworkTimeout(error);
}

// ---------------------------------------------------------------------------
// Delay calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the delay for a given attempt, with jitter applied.
 *
 * Formula: min(base * multiplier^(attempt-1), max) * (1 +/- jitter)
 *
 * @param attempt - 1-based attempt number (attempt=1 is first retry)
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
  const baseDelay = Math.min(
    config.baseDelayMs * Math.pow(config.multiplier, attempt - 1),
    config.maxDelayMs,
  );
  // Apply +/- jitter: random in [-jitterPercent, +jitterPercent]
  const jitterMultiplier = 1 + (Math.random() * 2 - 1) * config.jitterPercent;
  return Math.max(1, Math.round(baseDelay * jitterMultiplier));
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Wraps an async function with retry logic using exponential backoff + jitter.
 *
 * Retries on: HTTP 429, 500, 502, 503, network timeouts.
 * Does NOT retry on: 400, 401, 403, 404 or non-transient errors.
 *
 * @param fn - The async function to retry (called with no arguments)
 * @param config - Partial override of RetryConfig (merged with defaults)
 * @param log - Optional logging callback for retry messages
 * @returns The resolved value of `fn` on first success
 * @throws The last error if all attempts fail or a non-retryable error occurs
 *
 * @example
 * ```typescript
 * const response = await withRetry(
 *   () => chatModel.sendRequest(messages, {}, token),
 *   { maxRetries: 3 },
 *   (msg) => console.log(msg),
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
  log?: (msg: string) => void,
): Promise<T> {
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  let lastError: unknown;

  // Attempt indices: initial call (1) + up to maxRetries retries
  for (let attempt = 1; attempt <= cfg.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;

      // On the last attempt, or if not retryable -- propagate immediately
      if (attempt > cfg.maxRetries || !isRetryable(err, cfg)) {
        throw err;
      }

      const delayMs = calculateDelay(attempt, cfg);
      const status = getErrorStatus(err);
      const statusStr = status !== null ? ` (HTTP ${status})` : '';

      log?.(
        `[RetryWithBackoff] Attempt ${attempt}/${cfg.maxRetries} failed${statusStr}.`
        + ` Retrying in ${delayMs}ms...`,
      );

      await sleepMs(delayMs);
    }
  }

  // This line is unreachable: the loop either returns or throws.
  // TypeScript needs it to narrow the return type.
  throw lastError;
}
