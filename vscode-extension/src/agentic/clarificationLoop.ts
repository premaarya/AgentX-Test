// ---------------------------------------------------------------------------
// AgentX -- Clarification Loop
// ---------------------------------------------------------------------------
//
// Handles inter-agent clarification as a separate, dedicated module.
// When a main agent (e.g., Architect) needs information from a different
// agent (e.g., Product Manager), this loop manages the back-and-forth
// conversation between them.
//
// The loop spawns the target agent as a sub-agent, passes the question,
// and manages follow-up exchanges until the clarification is resolved or
// the maximum iteration count is reached.
//
// If max iterations are exhausted without resolution, the loop hands off
// to a human operator for manual clarification.
//
// Max iterations are configurable (default: 6).
// Works in both Chat mode (VS Code) and CLI mode (agentic-runner.ps1).
// ---------------------------------------------------------------------------

import {
  SubAgentConfig,
  SubAgentResult,
  LlmAdapterFactory,
  AgentLoader,
} from './subAgentSpawner';
import { spawnSubAgent } from './subAgentSpawner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for the clarification loop. */
export interface ClarificationLoopConfig {
  /**
   * Maximum back-and-forth iterations between agents. Default: 6.
   * Each iteration = one question + one answer exchange.
   */
  readonly maxIterations: number;
  /** Workspace root for tool access. */
  readonly workspaceRoot: string;
  /**
   * Maximum iterations for the responding sub-agent's internal loop.
   * Default: 5.
   */
  readonly responderMaxIterations?: number;
  /**
   * Token budget for the responding sub-agent. Default: 20_000.
   */
  readonly responderTokenBudget?: number;
  /**
   * Handler called when max iterations are reached without resolution.
   * If provided, the human's response is returned as the final answer.
   * If not provided, the loop returns with escalatedToHuman=true and
   * a message indicating manual intervention is needed.
   */
  readonly onHumanFallback?: (
    topic: string,
    context: string,
  ) => Promise<string>;
}

/** Result of the clarification loop. */
export interface ClarificationLoopResult {
  /** Whether the clarification was fully resolved. */
  readonly resolved: boolean;
  /** The final answer/information obtained. */
  readonly answer: string;
  /** Number of back-and-forth iterations used. */
  readonly iterations: number;
  /** Whether the clarification was escalated to a human. */
  readonly escalatedToHuman: boolean;
  /** Full exchange history for audit/logging. */
  readonly exchangeHistory: readonly ClarificationExchange[];
}

/** A single exchange in the clarification conversation. */
export interface ClarificationExchange {
  /** The question asked. */
  readonly question: string;
  /** The response received. */
  readonly response: string;
  /** Which iteration this exchange occurred in. */
  readonly iteration: number;
  /** Who responded ('sub-agent' or 'human'). */
  readonly respondedBy: 'sub-agent' | 'human';
}

/** Progress callbacks for the clarification loop. */
export interface ClarificationProgress {
  /**
   * Called at the start of each clarification iteration.
   * @param iteration - Current iteration (1-based).
   * @param maxIterations - Total allowed iterations.
   * @param context - Optional context about the exchange.
   */
  onClarificationIteration?(
    iteration: number,
    maxIterations: number,
    context?: {
      readonly fromAgent: string;
      readonly toAgent: string;
      readonly topic: string;
      readonly question: string;
    },
  ): void;
  /** Called when the sub-agent provides a response. */
  onSubAgentResponse?(response: string, iteration: number): void;
  /** Called when clarification is being escalated to a human. */
  onHumanEscalation?(topic: string): void;
  /** Called when clarification is resolved. */
  onResolved?(answer: string, iterations: number): void;
}

/** Callback type for the main loop to evaluate if clarification is resolved. */
export type ClarificationEvaluator = (
  question: string,
  answer: string,
  iteration: number,
) => ClarificationEvaluation;

/** Result of evaluating whether a clarification answer is sufficient. */
export interface ClarificationEvaluation {
  /** Whether the answer sufficiently resolves the question. */
  readonly resolved: boolean;
  /** Follow-up question if not resolved. */
  readonly followUp?: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CLARIFICATION_CONFIG: Partial<ClarificationLoopConfig> = {
  maxIterations: 6,
  responderMaxIterations: 5,
  responderTokenBudget: 20_000,
};

// ---------------------------------------------------------------------------
// Prompt Builders
// ---------------------------------------------------------------------------

/**
 * Build the system prompt for the responding sub-agent in clarification mode.
 */
function buildResponderSystemPrompt(
  responderRole: string,
  requestingRole: string,
): string {
  return [
    `You are the ${responderRole} agent responding to a clarification request.`,
    `The ${requestingRole} agent needs information from you to proceed with their work.`,
    '',
    '## Your Task',
    '1. Carefully read the question and provide a thorough, actionable answer.',
    '2. Use workspace tools (file_read, grep_search, list_dir) to gather context if needed.',
    '3. Be specific and provide concrete guidance -- avoid vague or generic answers.',
    '4. If you need workspace context to answer, explore the codebase first.',
    '',
    '## Response Format',
    'Provide your answer directly. Be clear, specific, and actionable.',
    'If you cannot fully answer, explain what you know and what is uncertain.',
    '',
    '## Important',
    '- Answer from YOUR role perspective (you are the ' + responderRole + ')',
    '- The requesting agent needs this information to unblock their work',
    '- If the question is outside your expertise, say so clearly',
  ].join('\n');
}

/**
 * Build the clarification prompt including conversation history.
 */
function buildClarificationPrompt(
  topic: string,
  currentQuestion: string,
  previousExchanges: readonly ClarificationExchange[],
  requestingRole: string,
): string {
  const parts: string[] = [];

  parts.push(`## Clarification Request from ${requestingRole}`);
  parts.push(`**Topic**: ${topic}`);
  parts.push('');

  if (previousExchanges.length > 0) {
    parts.push('### Previous Exchanges');
    for (const ex of previousExchanges) {
      parts.push(`**Q${ex.iteration}**: ${ex.question}`);
      parts.push(`**A${ex.iteration}**: ${ex.response}`);
      parts.push('');
    }
    parts.push('### Follow-up Question');
  }

  parts.push(currentQuestion);

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Default Evaluator
// ---------------------------------------------------------------------------

/**
 * Default evaluator that checks if a clarification answer is sufficient.
 * Uses simple heuristics -- callers can provide a custom evaluator for
 * LLM-based evaluation.
 */
export function defaultClarificationEvaluator(
  _question: string,
  answer: string,
  _iteration: number,
): ClarificationEvaluation {
  // Check for obvious non-answers
  const nonAnswerPatterns = [
    /i don'?t know/i,
    /i'?m not sure/i,
    /i cannot (answer|help)/i,
    /outside my expertise/i,
    /you should ask/i,
    /I would need more context/i,
  ];

  for (const pattern of nonAnswerPatterns) {
    if (pattern.test(answer)) {
      return {
        resolved: false,
        followUp: 'The previous answer was insufficient. '
          + 'Please try to provide more specific guidance, '
          + 'or indicate what additional context you would need.',
      };
    }
  }

  // If the answer is very short, it may not be sufficient
  if (answer.length < 50) {
    return {
      resolved: false,
      followUp: 'Could you elaborate on your answer? '
        + 'The response was brief and may not fully address the question.',
    };
  }

  // Default: consider the answer sufficient
  return { resolved: true };
}

// ---------------------------------------------------------------------------
// Clarification Loop
// ---------------------------------------------------------------------------

/**
 * Run a clarification loop between two agents.
 *
 * The loop manages back-and-forth exchanges between the requesting agent
 * (main agent) and the responding agent (sub-agent loaded from .agent.md):
 *
 *   1. Main agent asks a question about a topic
 *   2. Sub-agent (different role) processes the question and responds
 *   3. Evaluator checks if the answer resolves the clarification
 *   4. If not resolved, evaluator generates a follow-up question
 *   5. Loop continues until resolved or max iterations reached
 *   6. If max iterations exhausted, escalate to human
 *
 * @param config - Clarification loop configuration
 * @param fromAgent - The requesting agent's role (e.g., 'architect')
 * @param toAgent - The responding agent's role (e.g., 'product-manager')
 * @param topic - Short topic label for the clarification
 * @param initialQuestion - The full initial question
 * @param llmFactory - Factory to create LLM adapters
 * @param agentLoader - Loader for agent definitions
 * @param abortSignal - Abort signal for cancellation
 * @param evaluator - Function to evaluate if the answer is sufficient
 * @param progress - Optional progress callbacks
 * @returns Clarification loop result
 */
export async function runClarificationLoop(
  config: ClarificationLoopConfig,
  fromAgent: string,
  toAgent: string,
  topic: string,
  initialQuestion: string,
  llmFactory: LlmAdapterFactory,
  agentLoader: AgentLoader,
  abortSignal: AbortSignal,
  evaluator?: ClarificationEvaluator,
  progress?: ClarificationProgress,
): Promise<ClarificationLoopResult> {
  const maxIter = config.maxIterations ?? DEFAULT_CLARIFICATION_CONFIG.maxIterations!;
  const responderMaxIter = config.responderMaxIterations ?? DEFAULT_CLARIFICATION_CONFIG.responderMaxIterations!;
  const responderBudget = config.responderTokenBudget ?? DEFAULT_CLARIFICATION_CONFIG.responderTokenBudget!;

  const evaluate = evaluator ?? defaultClarificationEvaluator;
  const exchanges: ClarificationExchange[] = [];
  let currentQuestion = initialQuestion;

  for (let iteration = 1; iteration <= maxIter; iteration++) {
    if (abortSignal.aborted) { break; }

    progress?.onClarificationIteration?.(iteration, maxIter, {
      fromAgent,
      toAgent,
      topic,
      question: currentQuestion,
    });

    // Build prompt with conversation history
    const prompt = buildClarificationPrompt(
      topic,
      currentQuestion,
      exchanges,
      fromAgent,
    );

    // Spawn responding sub-agent
    const responderConfig: SubAgentConfig = {
      role: toAgent,
      maxIterations: responderMaxIter,
      tokenBudget: responderBudget,
      systemPromptOverride: buildResponderSystemPrompt(toAgent, fromAgent),
      workspaceRoot: config.workspaceRoot,
      includeTools: true,
    };

    const subResult: SubAgentResult = await spawnSubAgent(
      responderConfig,
      prompt,
      llmFactory,
      agentLoader,
      abortSignal,
    );

    // If the sub-agent errored (e.g., no model available), treat as unresolved
    if (subResult.exitReason === 'error') {
      currentQuestion = `The responding agent encountered an error: ${subResult.response.slice(0, 200)}. `
        + `Please try to answer the original question about: ${topic}`;
      continue;
    }

    const responseText = subResult.response;
    progress?.onSubAgentResponse?.(responseText, iteration);

    // Record the exchange
    exchanges.push({
      question: currentQuestion,
      response: responseText,
      iteration,
      respondedBy: 'sub-agent',
    });

    // Evaluate whether the answer resolves the clarification
    const evaluation = evaluate(currentQuestion, responseText, iteration);

    if (evaluation.resolved) {
      progress?.onResolved?.(responseText, iteration);
      return {
        resolved: true,
        answer: responseText,
        iterations: iteration,
        escalatedToHuman: false,
        exchangeHistory: exchanges,
      };
    }

    // Not resolved -- prepare follow-up question
    currentQuestion = evaluation.followUp
      ?? `The previous answer did not fully resolve the question. `
        + `Please provide more specific guidance about: ${topic}`;
  }

  // Max iterations reached -- escalate to human
  progress?.onHumanEscalation?.(topic);

  if (config.onHumanFallback) {
    // Build context summary for the human
    const contextSummary = buildHumanEscalationContext(
      fromAgent,
      toAgent,
      topic,
      exchanges,
    );

    try {
      const humanAnswer = await config.onHumanFallback(topic, contextSummary);

      exchanges.push({
        question: `[Escalated to human] ${topic}`,
        response: humanAnswer,
        iteration: exchanges.length + 1,
        respondedBy: 'human',
      });

      return {
        resolved: true,
        answer: humanAnswer,
        iterations: exchanges.length,
        escalatedToHuman: true,
        exchangeHistory: exchanges,
      };
    } catch {
      // Human fallback failed -- return unresolved
    }
  }

  // Build best-effort answer from all exchanges
  const bestAnswer = exchanges.length > 0
    ? exchanges[exchanges.length - 1].response
    : '(No response obtained)';

  return {
    resolved: false,
    answer: `[UNRESOLVED - Escalated to human]\n\n`
      + `Topic: ${topic}\n`
      + `${maxIter} clarification rounds between ${fromAgent} and ${toAgent} `
      + `did not fully resolve the question.\n\n`
      + `Best answer so far:\n${bestAnswer}`,
    iterations: maxIter,
    escalatedToHuman: true,
    exchangeHistory: exchanges,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a context summary for human escalation.
 */
function buildHumanEscalationContext(
  fromAgent: string,
  toAgent: string,
  topic: string,
  exchanges: readonly ClarificationExchange[],
): string {
  const parts: string[] = [];

  parts.push(`## Clarification Escalation`);
  parts.push('');
  parts.push(`**From**: ${fromAgent} agent`);
  parts.push(`**To**: ${toAgent} agent`);
  parts.push(`**Topic**: ${topic}`);
  parts.push(`**Attempts**: ${exchanges.length}`);
  parts.push('');
  parts.push('### Exchange History');

  for (const ex of exchanges) {
    parts.push(`#### Round ${ex.iteration}`);
    parts.push(`**Q**: ${ex.question}`);
    parts.push(`**A**: ${ex.response}`);
    parts.push('');
  }

  parts.push('### What is needed');
  parts.push(`The ${fromAgent} agent needs a definitive answer about "${topic}" `);
  parts.push(`to proceed with their work. The automated ${toAgent} agent `);
  parts.push('was unable to provide a sufficient answer.');

  return parts.join('\n');
}

/**
 * Get the default clarification loop config.
 */
export function getDefaultClarificationConfig(
  workspaceRoot: string,
): ClarificationLoopConfig {
  return {
    maxIterations: DEFAULT_CLARIFICATION_CONFIG.maxIterations!,
    workspaceRoot,
    responderMaxIterations: DEFAULT_CLARIFICATION_CONFIG.responderMaxIterations!,
    responderTokenBudget: DEFAULT_CLARIFICATION_CONFIG.responderTokenBudget!,
  };
}
