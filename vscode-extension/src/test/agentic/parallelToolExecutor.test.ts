import { strict as assert } from 'assert';
import {
  ParallelToolExecutor,
  detectDependencies,
  DependencyGraph,
} from '../../agentic/parallelToolExecutor';
import {
  ToolCallRequest,
  ToolResult,
  ToolContext,
  ToolRegistry,
  AgentToolDef,
} from '../../agentic/toolEngine';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCtx(log?: (msg: string) => void): ToolContext {
  const controller = new AbortController();
  return {
    workspaceRoot: '/workspace',
    abortSignal: controller.signal,
    log: log ?? (() => undefined),
  };
}

function makeCall(
  id: string,
  name: string,
  params: Record<string, unknown> = {},
): ToolCallRequest {
  return { id, name, params };
}

function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: 'text', text }], isError };
}

/**
 * Create a ToolRegistry with a set of fake tools.
 * `toolFns` maps tool name to a function that returns a result.
 */
function makeRegistry(
  toolFns: Record<string, (params: Record<string, unknown>) => Promise<ToolResult>>,
): ToolRegistry {
  const registry = new ToolRegistry();
  for (const [name, fn] of Object.entries(toolFns)) {
    const def: AgentToolDef = {
      name,
      description: `Mock tool ${name}`,
      parameters: {},
      mutating: false,
      execute: (params) => fn(params),
    };
    registry.register(def);
  }
  return registry;
}

// ---------------------------------------------------------------------------
// detectDependencies
// ---------------------------------------------------------------------------

describe('detectDependencies', () => {
  it('returns no dependencies for a single call', () => {
    const calls = [makeCall('1', 'file_read', { filePath: 'a.ts' })];
    const graph = detectDependencies(calls);
    assert.equal(graph.hasDependencies, false);
    assert.equal(graph.dependencies[0].size, 0);
  });

  it('returns no dependencies for multiple read-only calls on different files', () => {
    const calls = [
      makeCall('1', 'file_read', { filePath: 'a.ts' }),
      makeCall('2', 'file_read', { filePath: 'b.ts' }),
      makeCall('3', 'grep_search', { pattern: 'foo' }),
    ];
    const graph = detectDependencies(calls);
    assert.equal(graph.hasDependencies, false);
  });

  it('detects dependency when read-only tool reads a previously-written file', () => {
    const calls = [
      makeCall('1', 'file_write', { filePath: 'a.ts' }),
      makeCall('2', 'file_read', { filePath: 'a.ts' }),
    ];
    const graph = detectDependencies(calls);
    assert.equal(graph.hasDependencies, true);
    assert.ok(graph.dependencies[1].has(0), 'call[1] should depend on call[0]');
  });

  it('detects dependency when mutating tool writes to already-written file', () => {
    const calls = [
      makeCall('1', 'file_write', { filePath: 'a.ts' }),
      makeCall('2', 'file_edit', { filePath: 'a.ts' }),
    ];
    const graph = detectDependencies(calls);
    assert.equal(graph.hasDependencies, true);
    assert.ok(graph.dependencies[1].has(0));
  });

  it('no dependency for read-only tools on same file (multiple reads are safe)', () => {
    const calls = [
      makeCall('1', 'file_read', { filePath: 'readme.md' }),
      makeCall('2', 'file_read', { filePath: 'readme.md' }),
    ];
    const graph = detectDependencies(calls);
    assert.equal(graph.hasDependencies, false);
  });

  it('detects output reference dependency (param contains another call id)', () => {
    const calls = [
      makeCall('call-abc', 'file_read', { filePath: 'a.ts' }),
      makeCall('call-xyz', 'file_write', { filePath: 'b.ts', content: 'uses call-abc result' }),
    ];
    const graph = detectDependencies(calls);
    assert.equal(graph.hasDependencies, true);
    assert.ok(graph.dependencies[1].has(0));
  });

  it('returns empty graph for empty calls', () => {
    const graph = detectDependencies([]);
    assert.equal(graph.hasDependencies, false);
    assert.equal(graph.dependencies.length, 0);
  });
});

// ---------------------------------------------------------------------------
// ParallelToolExecutor -- basic cases
// ---------------------------------------------------------------------------

describe('ParallelToolExecutor -- basic', () => {
  it('returns empty array for empty calls', async () => {
    const executor = new ParallelToolExecutor();
    const registry = makeRegistry({});
    const ctx = makeCtx();
    const results = await executor.analyzeAndExecute([], registry, ctx);
    assert.deepEqual(results, []);
  });

  it('executes a single call and returns its result', async () => {
    const executor = new ParallelToolExecutor();
    const registry = makeRegistry({
      my_tool: async () => textResult('single result'),
    });
    const ctx = makeCtx();
    const results = await executor.analyzeAndExecute(
      [makeCall('1', 'my_tool')],
      registry,
      ctx,
    );
    assert.equal(results.length, 1);
    assert.equal(results[0].content[0].text, 'single result');
    assert.equal(results[0].isError, false);
  });

  it('returns results IN ORIGINAL call order when parallel', async () => {
    const delays = [30, 5, 15]; // call[0] is slowest
    const executor = new ParallelToolExecutor();
    const registry = makeRegistry({
      slow_tool: async () => {
        await new Promise((r) => setTimeout(r, delays[0]));
        return textResult('A');
      },
      fast_tool: async () => {
        await new Promise((r) => setTimeout(r, delays[1]));
        return textResult('B');
      },
      med_tool: async () => {
        await new Promise((r) => setTimeout(r, delays[2]));
        return textResult('C');
      },
    });
    const calls = [
      makeCall('1', 'slow_tool'),
      makeCall('2', 'fast_tool'),
      makeCall('3', 'med_tool'),
    ];
    const results = await executor.analyzeAndExecute(calls, registry, makeCtx() as ToolContext);
    assert.equal(results[0].content[0].text, 'A');
    assert.equal(results[1].content[0].text, 'B');
    assert.equal(results[2].content[0].text, 'C');
  });
});

// ---------------------------------------------------------------------------
// ParallelToolExecutor -- failure isolation
// ---------------------------------------------------------------------------

describe('ParallelToolExecutor -- failure isolation', () => {
  it('one failing tool does not cancel others (Promise.allSettled)', async () => {
    const executor = new ParallelToolExecutor();
    let bExecuted = false;
    const registry = makeRegistry({
      tool_a: async () => { throw new Error('Tool A exploded'); },
      tool_b: async () => { bExecuted = true; return textResult('B ok'); },
    });
    const ctx = makeCtx();
    const results = await executor.analyzeAndExecute(
      [makeCall('1', 'tool_a'), makeCall('2', 'tool_b')],
      registry,
      ctx,
    );

    assert.equal(results.length, 2);
    // tool_a produced an error result
    assert.equal(results[0].isError, true);
    // tool_b still ran
    assert.equal(bExecuted, true);
    assert.equal(results[1].isError, false);
    assert.equal(results[1].content[0].text, 'B ok');
  });

  it('wraps thrown errors as isError ToolResult', async () => {
    const executor = new ParallelToolExecutor();
    const registry = makeRegistry({
      boom: async () => { throw new Error('Kaboom'); },
    });
    const ctx = makeCtx();
    const results = await executor.analyzeAndExecute(
      [makeCall('1', 'boom')],
      registry,
      ctx,
    );
    assert.equal(results[0].isError, true);
    assert.ok(results[0].content[0].text.includes('Kaboom'));
  });

  it('tool registry error (unknown tool) is returned as isError', async () => {
    const executor = new ParallelToolExecutor();
    const registry = new ToolRegistry();
    const ctx = makeCtx();
    const results = await executor.analyzeAndExecute(
      [makeCall('1', 'nonexistent_tool')],
      registry,
      ctx,
    );
    assert.equal(results[0].isError, true);
  });
});

// ---------------------------------------------------------------------------
// ParallelToolExecutor -- dependency ordering
// ---------------------------------------------------------------------------

describe('ParallelToolExecutor -- dependency ordering', () => {
  it('executes dependent calls in correct order', async () => {
    const executor = new ParallelToolExecutor();
    const order: string[] = [];
    const registry = makeRegistry({
      file_write: async (params) => {
        order.push(`write:${params.filePath}`);
        return textResult('written');
      },
      file_read: async (params) => {
        order.push(`read:${params.filePath}`);
        return textResult('read');
      },
    });
    const ctx = makeCtx();

    const calls = [
      makeCall('1', 'file_write', { filePath: 'out.ts' }),
      makeCall('2', 'file_read', { filePath: 'out.ts' }),
    ];

    await executor.analyzeAndExecute(calls, registry, ctx);

    assert.equal(order[0], 'write:out.ts', 'write should execute first');
    assert.equal(order[1], 'read:out.ts', 'read should execute after write');
  });

  it('independent reads all execute before any dependent read', async () => {
    const executor = new ParallelToolExecutor();
    const order: string[] = [];

    const registry = makeRegistry({
      file_write: async () => {
        order.push('write');
        return textResult('written');
      },
      file_read: async (params) => {
        order.push(`read:${params.filePath}`);
        return textResult('content');
      },
    });

    const ctx = makeCtx();
    const calls = [
      makeCall('1', 'file_read', { filePath: 'a.ts' }),
      makeCall('2', 'file_read', { filePath: 'b.ts' }),
      makeCall('3', 'file_write', { filePath: 'c.ts' }),
    ];

    const results = await executor.analyzeAndExecute(calls, registry, ctx);
    assert.equal(results.length, 3);
    // The first two reads should complete without waiting for write
    assert.ok(order.includes('read:a.ts'));
    assert.ok(order.includes('read:b.ts'));
  });
});

// ---------------------------------------------------------------------------
// ParallelToolExecutor -- logging
// ---------------------------------------------------------------------------

describe('ParallelToolExecutor -- logging', () => {
  it('logs elapsed time for parallel batches', async () => {
    const logs: string[] = [];
    const executor = new ParallelToolExecutor();
    const registry = makeRegistry({
      tool_x: async () => textResult('x'),
      tool_y: async () => textResult('y'),
    });
    const ctx = makeCtx((msg) => logs.push(msg));

    await executor.analyzeAndExecute(
      [makeCall('1', 'tool_x'), makeCall('2', 'tool_y')],
      registry,
      ctx,
    );

    const found = logs.some((l) => l.includes('ParallelToolExecutor') && l.includes('parallel'));
    assert.ok(found, `Expected a ParallelToolExecutor log entry, got: ${logs.join(', ')}`);
  });
});

// Suppress unused import warning for ToolResult
void ((_: ToolResult) => _);
