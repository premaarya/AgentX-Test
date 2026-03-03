// ---------------------------------------------------------------------------
// AgentX -- Parallel Tool Executor
// ---------------------------------------------------------------------------
//
// Analyzes a batch of tool call requests, detects inter-call dependencies,
// and executes independent calls concurrently via Promise.allSettled.
//
// Dependency heuristics (per ADR-47.3):
//   - Read-only tools with different targets are independent (run parallel)
//   - Any mutating tool that targets a path previously written is dependent
//   - Tools whose params reference another tool's ID are dependent
//   - When dependencies exist, affected calls run in topological batches
//
// Promise.allSettled is used so that one failure does NOT cancel others.
// Results are always returned in the original call order.
// ---------------------------------------------------------------------------

import {
  ToolCallRequest,
  ToolResult,
  ToolContext,
  ToolRegistry,
} from './toolEngine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Dependency graph for a batch of tool calls.
 * `dependencies[i]` is the set of call indices that call[i] must wait for.
 */
export interface DependencyGraph {
  /** Per-call dependency sets, indexed by call position. */
  readonly dependencies: readonly ReadonlySet<number>[];
  /** True if any call has at least one dependency. */
  readonly hasDependencies: boolean;
}

// ---------------------------------------------------------------------------
// Read-only tool detection
// ---------------------------------------------------------------------------

/**
 * Tool names that are guaranteed to not mutate any shared state.
 * Read-only tools with different targets are safe to run in parallel.
 */
const READ_ONLY_TOOL_NAMES = new Set([
  'file_read',
  'grep_search',
  'list_dir',
  'validate_done',
  'request_clarification',
]);

// ---------------------------------------------------------------------------
// Dependency Detection
// ---------------------------------------------------------------------------

/**
 * Analyze a batch of tool calls and produce a dependency graph.
 *
 * Algorithm:
 *   1. Track file paths written by mutating tools left-to-right
 *   2. If tool[i] writes to a path that was already written, it depends on
 *      ALL previous calls (conservative ordering for correctness)
 *   3. If a read-only tool[i] reads a path that was already written, it
 *      depends on the specific writer(s)
 *   4. If tool[i]'s params contain another tool's call ID, it depends on it
 *
 * @pure (does not execute any tools)
 */
export function detectDependencies(calls: readonly ToolCallRequest[]): DependencyGraph {
  const n = calls.length;
  const deps: Set<number>[] = Array.from({ length: n }, () => new Set<number>());

  // Track which call index last wrote to each file path
  const lastWriterByPath = new Map<string, number[]>();
  let foundAny = false;

  for (let i = 0; i < n; i++) {
    const call = calls[i];
    const filePath = typeof call.params.filePath === 'string' ? call.params.filePath : '';
    const isReadOnly = READ_ONLY_TOOL_NAMES.has(call.name);

    if (!isReadOnly) {
      // Mutating tool: check if any previous mutating tool wrote to same path
      if (filePath) {
        const previousWriters = lastWriterByPath.get(filePath);
        if (previousWriters && previousWriters.length > 0) {
          // Depend on all previous writers of this path
          for (const w of previousWriters) {
            deps[i].add(w);
            foundAny = true;
          }
        }
        // Register as a writer
        const writers = lastWriterByPath.get(filePath) ?? [];
        writers.push(i);
        lastWriterByPath.set(filePath, writers);
      }
    } else {
      // Read-only tool: check if target was previously written
      if (filePath) {
        const previousWriters = lastWriterByPath.get(filePath);
        if (previousWriters && previousWriters.length > 0) {
          for (const w of previousWriters) {
            deps[i].add(w);
            foundAny = true;
          }
        }
      }
    }

    // Output reference heuristic: if this call's params contain another call's ID
    const paramValues: string[] = [];
    for (const v of Object.values(call.params)) {
      if (v !== null && v !== undefined) {
        paramValues.push(String(v));
      }
    }
    for (let j = 0; j < i; j++) {
      if (paramValues.some((val) => val.includes(calls[j].id))) {
        deps[i].add(j);
        foundAny = true;
      }
    }
  }

  return {
    dependencies: deps.map((d) => new Set(d) as ReadonlySet<number>),
    hasDependencies: foundAny,
  };
}

// ---------------------------------------------------------------------------
// ParallelToolExecutor
// ---------------------------------------------------------------------------

/**
 * Executes a batch of tool call requests, running independent calls in
 * parallel and dependent calls sequentially.
 *
 * Key guarantees:
 *  - Results are returned in original call order
 *  - One failure does NOT cancel other concurrent calls
 *  - Each tool error is captured and returned as an error ToolResult
 *  - Elapsed time for parallel batches is logged via ctx.log
 */
export class ParallelToolExecutor {
  /**
   * Analyze dependencies among `calls`, then execute them -- parallel where
   * safe, sequential where ordering constraints exist.
   *
   * @param calls - Tool call requests from the LLM (may be empty)
   * @param registry - Tool registry that will execute each call
   * @param ctx - Tool context (workspaceRoot, abortSignal, log)
   * @returns Results in the same order as `calls`
   */
  async analyzeAndExecute(
    calls: readonly ToolCallRequest[],
    registry: ToolRegistry,
    ctx: ToolContext,
  ): Promise<ToolResult[]> {
    if (calls.length === 0) {
      return [];
    }

    if (calls.length === 1) {
      return [await registry.execute(calls[0], ctx)];
    }

    const graph = detectDependencies(calls);

    if (!graph.hasDependencies) {
      return this.executeParallel(calls, registry, ctx);
    }

    return this.executeWithDependencies(calls, graph, registry, ctx);
  }

  // -----------------------------------------------------------------------
  // Parallel execution (no dependencies)
  // -----------------------------------------------------------------------

  private async executeParallel(
    calls: readonly ToolCallRequest[],
    registry: ToolRegistry,
    ctx: ToolContext,
  ): Promise<ToolResult[]> {
    const startTime = Date.now();

    const settled = await Promise.allSettled(
      calls.map((call) => registry.execute(call, ctx)),
    );

    const elapsed = Date.now() - startTime;
    ctx.log(
      `[ParallelToolExecutor] ${calls.length} tools executed in parallel in ${elapsed}ms`,
    );

    return settled.map((r, i) => {
      if (r.status === 'fulfilled') {
        return r.value;
      }
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      return {
        content: [{ type: 'text' as const, text: `Tool ${calls[i].name} threw: ${msg}` }],
        isError: true,
      };
    });
  }

  // -----------------------------------------------------------------------
  // Topological batch execution (with dependencies)
  // -----------------------------------------------------------------------

  private async executeWithDependencies(
    calls: readonly ToolCallRequest[],
    graph: DependencyGraph,
    registry: ToolRegistry,
    ctx: ToolContext,
  ): Promise<ToolResult[]> {
    const results: Array<ToolResult | null> = new Array(calls.length).fill(null);
    const completed = new Set<number>();

    while (completed.size < calls.length) {
      // Find all calls whose dependencies are fully satisfied
      const ready: number[] = [];
      for (let i = 0; i < calls.length; i++) {
        if (completed.has(i)) { continue; }
        const callDeps = graph.dependencies[i];
        const allSatisfied = [...callDeps].every((d) => completed.has(d));
        if (allSatisfied) {
          ready.push(i);
        }
      }

      // Guard against cycles: fall back to sequential for remaining calls
      if (ready.length === 0) {
        const remaining = calls
          .map((_, i) => i)
          .filter((i) => !completed.has(i));

        ctx.log(
          `[ParallelToolExecutor] Dependency cycle detected; falling back to sequential for ${remaining.length} call(s)`,
        );

        for (const i of remaining) {
          results[i] = await registry.execute(calls[i], ctx);
          completed.add(i);
        }
        break;
      }

      // Execute the ready batch
      if (ready.length === 1) {
        results[ready[0]] = await registry.execute(calls[ready[0]], ctx);
        completed.add(ready[0]);
      } else {
        const startTime = Date.now();
        const settled = await Promise.allSettled(
          ready.map((i) => registry.execute(calls[i], ctx)),
        );
        const elapsed = Date.now() - startTime;
        ctx.log(
          `[ParallelToolExecutor] Batch of ${ready.length} independent tools executed in ${elapsed}ms`,
        );

        for (let j = 0; j < ready.length; j++) {
          const i = ready[j];
          const r = settled[j];
          if (r.status === 'fulfilled') {
            results[i] = r.value;
          } else {
            const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
            results[i] = {
              content: [{ type: 'text' as const, text: `Tool ${calls[i].name} threw: ${msg}` }],
              isError: true,
            };
          }
          completed.add(i);
        }
      }
    }

    return results as ToolResult[];
  }
}
