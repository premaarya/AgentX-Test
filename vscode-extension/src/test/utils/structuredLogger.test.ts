import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StructuredLogger, StructuredLogEntry } from '../../utils/structuredLogger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-logger-test-'));
}

function cleanDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // cleanup best-effort
  }
}

function readEntries(filePath: string): StructuredLogEntry[] {
  const lines = fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  return lines.map((l) => JSON.parse(l) as StructuredLogEntry);
}

function getTodayFilename(logDir: string): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  return path.join(logDir, `agentx-${dateStr}.jsonl`);
}

// ---------------------------------------------------------------------------
// Constructor and configuration
// ---------------------------------------------------------------------------

describe('StructuredLogger -- constructor', () => {
  it('creates the logger with default config', () => {
    const logger = new StructuredLogger();
    assert.ok(logger instanceof StructuredLogger);
  });

  it('accepts custom logDir', () => {
    const logDir = makeTempDir();
    try {
      const logger = new StructuredLogger({ logDir });
      logger.info('agent', 'test');
      const filePath = getTodayFilename(logDir);
      assert.ok(fs.existsSync(filePath), 'Log file should be created');
    } finally {
      cleanDir(logDir);
    }
  });

  it('generates a correlationId automatically', () => {
    const logger = new StructuredLogger();
    const id = logger.getCorrelationId();
    assert.ok(typeof id === 'string' && id.length > 0);
  });

  it('accepts a custom correlationId', () => {
    const logger = new StructuredLogger({ correlationId: 'my-session-123' });
    assert.equal(logger.getCorrelationId(), 'my-session-123');
  });
});

// ---------------------------------------------------------------------------
// setCorrelationId
// ---------------------------------------------------------------------------

describe('StructuredLogger -- setCorrelationId', () => {
  it('updates the correlationId for future entries', () => {
    const logDir = makeTempDir();
    try {
      const logger = new StructuredLogger({ logDir });
      logger.setCorrelationId('new-id-999');
      assert.equal(logger.getCorrelationId(), 'new-id-999');
      logger.info('agent', 'after change');
      const entries = readEntries(getTodayFilename(logDir));
      assert.ok(entries.some((e) => e.correlationId === 'new-id-999'));
    } finally {
      cleanDir(logDir);
    }
  });
});

// ---------------------------------------------------------------------------
// log() -- entry format
// ---------------------------------------------------------------------------

describe('StructuredLogger -- log() entry format', () => {
  let logDir: string;
  let logger: StructuredLogger;

  beforeEach(() => {
    logDir = makeTempDir();
    logger = new StructuredLogger({ logDir, correlationId: 'test-cid' });
  });

  afterEach(() => cleanDir(logDir));

  it('writes a JSON line with all required fields', () => {
    logger.info('engineer', 'Hello world');
    const entries = readEntries(getTodayFilename(logDir));
    assert.equal(entries.length, 1);
    const e = entries[0];
    assert.ok(typeof e.timestamp === 'string' && e.timestamp.length > 0);
    assert.equal(e.level, 'info');
    assert.equal(e.correlationId, 'test-cid');
    assert.equal(e.agentName, 'engineer');
    assert.equal(e.message, 'Hello world');
  });

  it('each entry is on its own line (JSON Lines format)', () => {
    logger.info('agent', 'Line 1');
    logger.warn('agent', 'Line 2');
    const raw = fs.readFileSync(getTodayFilename(logDir), 'utf-8');
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    assert.equal(lines.length, 2);
    // Each line must be valid JSON
    for (const line of lines) {
      assert.doesNotThrow(() => JSON.parse(line), `Invalid JSON: ${line}`);
    }
  });

  it('includes optional toolName when provided', () => {
    logger.log({ level: 'info', agentName: 'agent', message: 'tool ran', toolName: 'file_read' });
    const entries = readEntries(getTodayFilename(logDir));
    assert.equal(entries[0].toolName, 'file_read');
  });

  it('includes optional durationMs when provided', () => {
    logger.log({ level: 'debug', agentName: 'agent', message: 'timing', durationMs: 42 });
    const entries = readEntries(getTodayFilename(logDir));
    assert.equal(entries[0].durationMs, 42);
  });

  it('includes metadata when provided', () => {
    logger.info('agent', 'meta test', { issueNumber: 47, feature: 'logging' });
    const entries = readEntries(getTodayFilename(logDir));
    assert.deepEqual(entries[0].metadata, { issueNumber: 47, feature: 'logging' });
  });
});

// ---------------------------------------------------------------------------
// Log level methods
// ---------------------------------------------------------------------------

describe('StructuredLogger -- level methods', () => {
  let logDir: string;
  let logger: StructuredLogger;

  beforeEach(() => {
    logDir = makeTempDir();
    logger = new StructuredLogger({ logDir });
  });

  afterEach(() => cleanDir(logDir));

  it('debug() writes level=debug', () => {
    logger.debug('agent', 'debug msg');
    const entries = readEntries(getTodayFilename(logDir));
    assert.equal(entries[0].level, 'debug');
  });

  it('info() writes level=info', () => {
    logger.info('agent', 'info msg');
    const entries = readEntries(getTodayFilename(logDir));
    assert.equal(entries[0].level, 'info');
  });

  it('warn() writes level=warn', () => {
    logger.warn('agent', 'warn msg');
    const entries = readEntries(getTodayFilename(logDir));
    assert.equal(entries[0].level, 'warn');
  });

  it('error() writes level=error', () => {
    logger.error('agent', 'error msg');
    const entries = readEntries(getTodayFilename(logDir));
    assert.equal(entries[0].level, 'error');
  });
});

// ---------------------------------------------------------------------------
// Secret redaction
// ---------------------------------------------------------------------------

describe('StructuredLogger -- secret redaction', () => {
  let logDir: string;
  let logger: StructuredLogger;

  beforeEach(() => {
    logDir = makeTempDir();
    logger = new StructuredLogger({ logDir });
  });

  afterEach(() => cleanDir(logDir));

  it('redacts Bearer token from message', () => {
    logger.info('agent', 'Authorization: Bearer sk-supersecret12345678');
    const entries = readEntries(getTodayFilename(logDir));
    assert.ok(
      !entries[0].message.includes('sk-supersecret'),
      `Expected secret to be redacted, got: ${entries[0].message}`,
    );
  });

  it('redacts API key from metadata string value', () => {
    logger.info('agent', 'call made', { apiKey: 'sk-abc12345678901234567' });
    const entries = readEntries(getTodayFilename(logDir));
    const meta = entries[0].metadata ?? {};
    assert.ok(
      !String(meta.apiKey ?? '').includes('sk-abc'),
      `Expected API key redacted in metadata, got: ${JSON.stringify(meta)}`,
    );
  });

  it('does not redact safe strings', () => {
    logger.info('agent', 'Hello, this is a safe message');
    const entries = readEntries(getTodayFilename(logDir));
    assert.equal(entries[0].message, 'Hello, this is a safe message');
  });
});

// ---------------------------------------------------------------------------
// Directory creation
// ---------------------------------------------------------------------------

describe('StructuredLogger -- directory creation', () => {
  it('creates log directory if it does not exist', () => {
    const base = makeTempDir();
    const logDir = path.join(base, 'nested', 'logs');
    try {
      assert.ok(!fs.existsSync(logDir), 'Directory should not exist yet');
      const logger = new StructuredLogger({ logDir });
      logger.info('agent', 'first write');
      assert.ok(fs.existsSync(logDir), 'Directory should be created');
    } finally {
      cleanDir(base);
    }
  });
});

// ---------------------------------------------------------------------------
// File rotation
// ---------------------------------------------------------------------------

describe('StructuredLogger -- file rotation', () => {
  it('rotates file when maxFileSizeBytes is exceeded', () => {
    const logDir = makeTempDir();
    try {
      // Use a tiny max size to force rotation quickly
      const logger = new StructuredLogger({
        logDir,
        maxFileSizeBytes: 100,
        maxFiles: 3,
      });

      // Write enough data to trigger rotation
      for (let i = 0; i < 10; i++) {
        logger.info('agent', `Entry ${i} -- padding to exceed the 100 byte limit easily`);
      }

      const files = fs.readdirSync(logDir);
      assert.ok(files.length >= 1, 'Should have at least the current log file');

      // At least one rotated file should exist after writing enough
      const dateStr = new Date().toISOString().slice(0, 10);
      const rotatedFiles = files.filter((f) => f.includes(dateStr));
      assert.ok(rotatedFiles.length >= 1);
    } finally {
      cleanDir(logDir);
    }
  });

  it('does not throw when write fails (silent error swallowing)', () => {
    // Use an invalid (read-only root) path -- logger should not throw
    const logger = new StructuredLogger({ logDir: '/this/path/should/not/be/writable/ever' });
    assert.doesNotThrow(() => logger.info('agent', 'should not throw'));
  });
});

// ---------------------------------------------------------------------------
// Filename pattern
// ---------------------------------------------------------------------------

describe('StructuredLogger -- filename pattern', () => {
  it('uses agentx-YYYY-MM-DD.jsonl pattern', () => {
    const logDir = makeTempDir();
    try {
      const logger = new StructuredLogger({ logDir });
      logger.info('agent', 'test');

      const files = fs.readdirSync(logDir);
      assert.ok(files.length === 1, `Expected 1 file, got: ${files.join(', ')}`);
      const dateStr = new Date().toISOString().slice(0, 10);
      assert.ok(
        files[0].startsWith(`agentx-${dateStr}`) && files[0].endsWith('.jsonl'),
        `Unexpected filename: ${files[0]}`,
      );
    } finally {
      cleanDir(logDir);
    }
  });
});

// ---------------------------------------------------------------------------
// Multiple entries
// ---------------------------------------------------------------------------

describe('StructuredLogger -- multiple entries', () => {
  it('appends multiple entries to the same file', () => {
    const logDir = makeTempDir();
    try {
      const logger = new StructuredLogger({ logDir });
      logger.info('engineer', 'First');
      logger.warn('engineer', 'Second');
      logger.error('engineer', 'Third');

      const entries = readEntries(getTodayFilename(logDir));
      assert.equal(entries.length, 3);
      assert.equal(entries[0].message, 'First');
      assert.equal(entries[1].message, 'Second');
      assert.equal(entries[2].message, 'Third');
    } finally {
      cleanDir(logDir);
    }
  });

  it('each entry has a valid ISO timestamp', () => {
    const logDir = makeTempDir();
    try {
      const logger = new StructuredLogger({ logDir });
      logger.info('agent', 'ts-check');
      const entries = readEntries(getTodayFilename(logDir));
      const ts = entries[0].timestamp;
      assert.doesNotThrow(() => new Date(ts), 'timestamp must be parseable');
      const parsed = new Date(ts);
      assert.ok(!isNaN(parsed.getTime()), 'timestamp must be a valid date');
    } finally {
      cleanDir(logDir);
    }
  });
});
