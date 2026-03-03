// ---------------------------------------------------------------------------
// AgentX -- Structured JSON Logger with Rotation
// ---------------------------------------------------------------------------
//
// Writes structured log entries in JSON Lines format (.jsonl) to disk,
// with automatic file rotation at 10 MB and retention of the last 5 files.
//
// Features:
//   - JSON Lines format: one JSON object per line (per ADR-47.5)
//   - Secret redaction via redactSecrets() on all string fields
//   - File rotation at maxFileSizeBytes (default 10 MB), keep maxFiles (default 5)
//   - Log directory: .agentx/logs/ (configurable)
//   - Filename pattern: agentx-YYYY-MM-DD.jsonl
//   - Uses Node.js fs module (no VS Code API dependency)
//   - Errors during write/rotate are silently swallowed (logging MUST NOT throw)
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';
import { redactSecrets } from './secretRedactor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single structured log entry written to disk.
 */
export interface StructuredLogEntry {
  readonly timestamp: string;
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly correlationId: string;
  readonly agentName: string;
  readonly toolName?: string;
  readonly message: string;
  readonly durationMs?: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Configuration for StructuredLogger.
 */
export interface StructuredLoggerConfig {
  /** Directory where log files are written. Defaults to .agentx/logs/ */
  readonly logDir: string;
  /** Rotate the current log file when it exceeds this size in bytes. Default 10 MB */
  readonly maxFileSizeBytes: number;
  /**
   * Maximum number of rotated files to keep (including current).
   * Old files beyond this limit are deleted. Default 5.
   */
  readonly maxFiles: number;
  /**
   * Correlation ID to attach to every log entry.
   * Generated automatically if not provided.
   */
  readonly correlationId?: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const DEFAULT_MAX_FILES = 5;

// ---------------------------------------------------------------------------
// StructuredLogger
// ---------------------------------------------------------------------------

/**
 * Structured JSON Lines logger for AgentX.
 *
 * Usage:
 * ```typescript
 * const logger = new StructuredLogger({ logDir: '.agentx/logs' });
 * logger.info('engineer', 'Starting implementation', { issueNumber: 42 });
 * logger.error('engineer', 'Tool failed', { toolName: 'file_write', error: 'EACCES' });
 * ```
 */
export class StructuredLogger {
  private readonly logDir: string;
  private readonly maxFileSizeBytes: number;
  private readonly maxFiles: number;
  private correlationId: string;

  constructor(config?: Partial<StructuredLoggerConfig>) {
    this.logDir = config?.logDir ?? path.join(process.cwd(), '.agentx', 'logs');
    this.maxFileSizeBytes = config?.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;
    this.maxFiles = config?.maxFiles ?? DEFAULT_MAX_FILES;
    this.correlationId = config?.correlationId ?? this.generateCorrelationId();
  }

  // -----------------------------------------------------------------------
  // Correlation ID
  // -----------------------------------------------------------------------

  /** Override the correlation ID (e.g., with a session ID). */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /** Get the current correlation ID. */
  getCorrelationId(): string {
    return this.correlationId;
  }

  // -----------------------------------------------------------------------
  // Logging methods
  // -----------------------------------------------------------------------

  /** Log an entry with explicit level and all fields. */
  log(entry: Omit<StructuredLogEntry, 'timestamp' | 'correlationId'>): void {
    const safeMessage = redactSecrets(entry.message);
    const safeMetadata = entry.metadata
      ? this.redactMetadata(entry.metadata)
      : undefined;

    const fullEntry: StructuredLogEntry = {
      ...entry,
      message: safeMessage,
      metadata: safeMetadata,
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
    };

    this.writeEntry(fullEntry);
  }

  /** Log a debug message. */
  debug(
    agentName: string,
    message: string,
    meta?: Record<string, unknown>,
    toolName?: string,
    durationMs?: number,
  ): void {
    this.logAtLevel('debug', agentName, message, meta, toolName, durationMs);
  }

  /** Log an informational message. */
  info(
    agentName: string,
    message: string,
    meta?: Record<string, unknown>,
    toolName?: string,
    durationMs?: number,
  ): void {
    this.logAtLevel('info', agentName, message, meta, toolName, durationMs);
  }

  /** Log a warning. */
  warn(
    agentName: string,
    message: string,
    meta?: Record<string, unknown>,
    toolName?: string,
    durationMs?: number,
  ): void {
    this.logAtLevel('warn', agentName, message, meta, toolName, durationMs);
  }

  /** Log an error. */
  error(
    agentName: string,
    message: string,
    meta?: Record<string, unknown>,
    toolName?: string,
    durationMs?: number,
  ): void {
    this.logAtLevel('error', agentName, message, meta, toolName, durationMs);
  }

  // -----------------------------------------------------------------------
  // Internal: writing
  // -----------------------------------------------------------------------

  private logAtLevel(
    level: StructuredLogEntry['level'],
    agentName: string,
    message: string,
    meta?: Record<string, unknown>,
    toolName?: string,
    durationMs?: number,
  ): void {
    this.log({
      level,
      agentName,
      message,
      ...(toolName !== undefined && { toolName }),
      ...(durationMs !== undefined && { durationMs }),
      ...(meta !== undefined && { metadata: meta }),
    });
  }

  /**
   * Resolve the current log file path using today's UTC date.
   * Pattern: agentx-YYYY-MM-DD.jsonl
   */
  private getCurrentLogFilePath(): string {
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return path.join(this.logDir, `agentx-${dateStr}.jsonl`);
  }

  /**
   * Write a JSON Lines entry to the current log file.
   * Errors are silently ignored so logging never breaks the caller.
   */
  private writeEntry(entry: StructuredLogEntry): void {
    try {
      const filePath = this.getCurrentLogFilePath();

      // Ensure the log directory exists
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      // Rotate if the current file has grown beyond the size limit
      this.rotateIfNeeded(filePath);

      // Append the JSON line
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(filePath, line, 'utf-8');
    } catch {
      // Logging MUST NOT throw -- swallow all errors
    }
  }

  // -----------------------------------------------------------------------
  // Internal: rotation
  // -----------------------------------------------------------------------

  /**
   * Rotate the log file if it exceeds maxFileSizeBytes.
   *
   * Rotation strategy:
   *   current.jsonl  -> current.1.jsonl (most recent backup)
   *   current.1.jsonl -> current.2.jsonl
   *   ...
   *   current.(maxFiles-1).jsonl -> deleted
   *
   * After rotation, the current path is empty and ready for new entries.
   */
  private rotateIfNeeded(filePath: string): void {
    try {
      if (!fs.existsSync(filePath)) { return; }

      const stat = fs.statSync(filePath);
      if (stat.size < this.maxFileSizeBytes) { return; }

      const dir = path.dirname(filePath);
      const basename = path.basename(filePath, '.jsonl');

      // Shift existing rotated files: .4 -> delete, .3 -> .4, ..., .1 -> .2
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const olderFile = path.join(dir, `${basename}.${i}.jsonl`);
        if (fs.existsSync(olderFile)) {
          if (i >= this.maxFiles - 1) {
            // Oldest backup beyond retention limit -- delete it
            fs.unlinkSync(olderFile);
          } else {
            // Shift it to the next slot
            const newerFile = path.join(dir, `${basename}.${i + 1}.jsonl`);
            fs.renameSync(olderFile, newerFile);
          }
        }
      }

      // Rename current file to .1
      const rotatedFile = path.join(dir, `${basename}.1.jsonl`);
      fs.renameSync(filePath, rotatedFile);
    } catch {
      // Rotation errors are non-fatal
    }
  }

  // -----------------------------------------------------------------------
  // Internal: redaction
  // -----------------------------------------------------------------------

  /**
   * Recursively redact secrets from metadata object string values.
   */
  private redactMetadata(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = redactSecrets(value);
      } else if (
        value !== null
        && typeof value === 'object'
        && !Array.isArray(value)
      ) {
        result[key] = this.redactMetadata(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  // -----------------------------------------------------------------------
  // Internal: ID generation
  // -----------------------------------------------------------------------

  private generateCorrelationId(): string {
    const rand = Math.random().toString(36).slice(2, 10);
    return `${Date.now()}-${rand}`;
  }
}
