// ---------------------------------------------------------------------------
// AgentX -- Self-Review Loop
// ---------------------------------------------------------------------------
//
// When ANY agent completes work, the self-review loop spawns a sub-agent of
// the SAME ROLE to review the output. The reviewer sub-agent examines the
// work, provides structured findings categorized by impact (high/medium/low),
// and the main agent addresses all non-low-impact findings before the loop
// can approve the work.
//
// This replaces the old DoneValidator pattern with a richer, LLM-based
// review mechanism that works for ALL agent roles (PM, Architect, Engineer,
// Tester, Data Scientist, etc.) -- not just code-producing agents.
//
// The loop continues until the reviewer approves or max iterations are
// reached. Max iterations are configurable (default: 15).
//
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

/** Impact level for a review finding. */
export type FindingImpact = 'high' | 'medium' | 'low';

/** A single finding from the reviewer sub-agent. */
export interface ReviewFinding {
  /** Severity of the finding. */
  readonly impact: FindingImpact;
  /** Description of what needs to be fixed or improved. */
  readonly description: string;
  /** Category (e.g., 'logic', 'tests', 'docs', 'style', 'security'). */
  readonly category: string;
}

/** Result of parsing the reviewer's response. */
export interface ReviewResult {
  /** Whether the reviewer approved the work. */
  readonly approved: boolean;
  /** Structured findings from the review. */
  readonly findings: readonly ReviewFinding[];
  /** Raw response text from the reviewer. */
  readonly rawResponse: string;
}

/** Configuration for the self-review loop. */
export interface SelfReviewConfig {
  /**
   * Maximum review iterations between main agent and reviewer sub-agent.
   * Each iteration = one review + one fix cycle. Default: 15.
   */
  readonly maxIterations: number;
  /** Role of the main agent (reviewer sub-agent uses the same role). */
  readonly role: string;
  /** Workspace root for tool access. */
  readonly workspaceRoot: string;
  /**
   * Maximum iterations for the reviewer sub-agent's internal loop.
   * The reviewer gets its own mini agentic loop. Default: 8.
   */
  readonly reviewerMaxIterations?: number;
  /**
   * Token budget for the reviewer sub-agent. Default: 30_000.
   */
  readonly reviewerTokenBudget?: number;
  /**
   * Whether to include write tools for the reviewer.
   * If false, reviewer can only read/search (default: false).
   */
  readonly reviewerCanWrite?: boolean;
}

/** Final result of the self-review loop. */
export interface SelfReviewResult {
  /** Whether the review ultimately approved the work. */
  readonly approved: boolean;
  /** All findings across all review iterations. */
  readonly allFindings: readonly ReviewFinding[];
  /** Non-low findings that were addressed. */
  readonly addressedFindings: readonly ReviewFinding[];
  /** Number of review iterations performed. */
  readonly iterations: number;
  /** Summary of the review process. */
  readonly summary: string;
}

/** Progress callbacks for the self-review loop. */
export interface SelfReviewProgress {
  /** Called at the start of each review iteration. */
  onReviewIteration?(iteration: number, maxIterations: number): void;
  /** Called when the reviewer returns findings. */
  onFindingsReceived?(findings: readonly ReviewFinding[], iteration: number): void;
  /** Called when the main agent is about to address findings. */
  onAddressingFindings?(count: number): void;
  /** Called when the reviewer approves the work. */
  onApproved?(iteration: number): void;
  /** Called when max iterations reached without approval. */
  onMaxIterationsReached?(iterations: number): void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_SELF_REVIEW_CONFIG: Partial<SelfReviewConfig> = {
  maxIterations: 15,
  reviewerMaxIterations: 8,
  reviewerTokenBudget: 30_000,
  reviewerCanWrite: false,
};

// ---------------------------------------------------------------------------
// Review Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Build the system prompt override for the reviewer sub-agent.
 * The reviewer is the SAME role but in "review mode".
 */
function buildReviewerSystemPrompt(role: string): string {
  return [
    `You are the ${role} agent operating in REVIEW MODE.`,
    'Your task is to review work produced by another instance of yourself.',
    '',
    '## Review Protocol',
    '1. Carefully examine all artifacts, code, documents, and outputs.',
    '2. Use workspace tools (file_read, grep_search, list_dir) to inspect files.',
    '3. Categorize each finding by impact: high, medium, or low.',
    '4. Provide actionable, specific feedback for each finding.',
    '',
    '## Response Format',
    'You MUST respond with a structured review using this EXACT format:',
    '',
    '```review',
    'APPROVED: true|false',
    '',
    'FINDINGS:',
    '- [HIGH] category: Description of the issue',
    '- [MEDIUM] category: Description of the issue',
    '- [LOW] category: Description of the issue',
    '```',
    '',
    '## Impact Guidelines',
    '- **HIGH**: Bugs, security issues, missing tests, broken functionality, data loss risk',
    '- **MEDIUM**: Logic gaps, incomplete docs, suboptimal patterns, missing edge cases',
    '- **LOW**: Style nits, naming preferences, minor improvements, cosmetic issues',
    '',
    '## Approval Criteria',
    '- APPROVED: true -- when no HIGH or MEDIUM findings remain',
    '- APPROVED: false -- when any HIGH or MEDIUM findings exist',
    '',
    '## Important',
    '- Be thorough but fair -- do not nitpick on style when logic is sound',
    '- Focus on correctness, completeness, and adherence to role constraints',
    '- If you cannot find significant issues, approve the work',
    '- Use tools to verify claims (run tests, check file contents, etc.)',
  ].join('\n');
}

/**
 * Build the review prompt that tells the reviewer what to review.
 */
function buildReviewPrompt(
  role: string,
  workArtifact: string,
  previousFindings?: readonly ReviewFinding[],
): string {
  const parts: string[] = [];

  parts.push(`## Review Request for ${role} Agent Output`);
  parts.push('');
  parts.push('### Work Summary');
  parts.push(workArtifact);
  parts.push('');

  if (previousFindings && previousFindings.length > 0) {
    parts.push('### Previously Reported Findings (should be addressed)');
    for (const f of previousFindings) {
      parts.push(`- [${f.impact.toUpperCase()}] ${f.category}: ${f.description}`);
    }
    parts.push('');
    parts.push('Please verify that the previously reported HIGH and MEDIUM findings ');
    parts.push('have been adequately addressed. Report any remaining issues.');
  } else {
    parts.push('Please review the work above and all related files in the workspace.');
    parts.push('Check for correctness, completeness, test coverage, and adherence to role constraints.');
  }

  parts.push('');
  parts.push('Respond using the structured review format (```review ... ```).');

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Response Parser
// ---------------------------------------------------------------------------

/**
 * Parse the reviewer sub-agent's response into structured findings.
 * Handles both the structured format and free-form text fallback.
 */
export function parseReviewResponse(responseText: string): ReviewResult {
  const findings: ReviewFinding[] = [];

  // Try to extract structured review block
  const reviewBlock = responseText.match(/```review\s*\n([\s\S]*?)```/);
  const textToParse = reviewBlock ? reviewBlock[1] : responseText;

  // Parse APPROVED status
  const approvedMatch = textToParse.match(/APPROVED:\s*(true|false)/i);
  let approved = false;
  if (approvedMatch) {
    approved = approvedMatch[1].toLowerCase() === 'true';
  }

  // Parse findings - match [HIGH], [MEDIUM], [LOW] patterns
  const findingPattern = /[-*]\s*\[(HIGH|MEDIUM|LOW)\]\s*([^:]+):\s*(.+)/gi;
  let match;
  while ((match = findingPattern.exec(textToParse)) !== null) {
    findings.push({
      impact: match[1].toLowerCase() as FindingImpact,
      description: match[3].trim(),
      category: match[2].trim().toLowerCase(),
    });
  }

  // If no structured findings were found, try to infer from text
  if (findings.length === 0 && !approved) {
    // Look for common issue indicators
    const issuePatterns = [
      { pattern: /\b(bug|error|broken|fails?|crash)\b/gi, impact: 'high' as FindingImpact },
      { pattern: /\b(missing|incomplete|should|needs?|lacks?)\b/gi, impact: 'medium' as FindingImpact },
      { pattern: /\b(minor|nit|style|consider|could)\b/gi, impact: 'low' as FindingImpact },
    ];

    for (const { pattern, impact } of issuePatterns) {
      if (pattern.test(textToParse)) {
        // General heuristic finding -- the reviewer did not use structured format
        findings.push({
          impact,
          description: `Reviewer noted ${impact}-level concerns (unstructured response). See raw response for details.`,
          category: 'general',
        });
        break;
      }
    }

    // If we still have no findings and no explicit approval, check for approval keywords
    if (findings.length === 0) {
      const approvalKeywords = /\b(lgtm|looks good|approved?|no issues|all good|well done|passes)\b/i;
      if (approvalKeywords.test(textToParse)) {
        approved = true;
      }
    }
  }

  return { approved, findings, rawResponse: responseText };
}

// ---------------------------------------------------------------------------
// Feedback Builder
// ---------------------------------------------------------------------------

/**
 * Build feedback text for the main agent from review findings.
 * Only includes non-low-impact findings that need to be addressed.
 */
function buildFindingsFeedback(
  findings: readonly ReviewFinding[],
  iteration: number,
  maxIterations: number,
): string {
  const nonLow = findings.filter(f => f.impact !== 'low');

  if (nonLow.length === 0) {
    return ''; // Nothing actionable
  }

  const parts: string[] = [];
  parts.push(`[Self-Review Iteration ${iteration}/${maxIterations} - FINDINGS]`);
  parts.push('');
  parts.push('The reviewer found the following issues that need to be addressed:');
  parts.push('');

  for (const f of nonLow) {
    parts.push(`- [${f.impact.toUpperCase()}] ${f.category}: ${f.description}`);
  }

  parts.push('');
  parts.push('Please address ALL high and medium findings above.');
  parts.push('Use workspace tools to make the necessary changes.');
  parts.push('When done fixing, provide a summary of what you changed.');

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Self-Review Loop
// ---------------------------------------------------------------------------

/**
 * Run the self-review loop for a completed agent's work.
 *
 * The loop:
 *   1. Spawns a sub-agent of the SAME ROLE in "review mode"
 *   2. The reviewer examines the work and provides structured findings
 *   3. Non-low-impact findings are fed back to the main agent's conversation
 *   4. The main agent addresses the findings (makes tool calls, edits files)
 *   5. The main agent signals "done" again -> back to step 1
 *   6. Loop exits when reviewer approves or max iterations hit
 *
 * @param config - Self-review configuration
 * @param workArtifact - Summary of the main agent's completed work
 * @param llmFactory - Factory to create LLM adapters for the reviewer sub-agent
 * @param agentLoader - Loader for agent definitions
 * @param abortSignal - Abort signal for cancellation
 * @param progress - Optional progress callbacks
 * @returns Self-review result
 */
export async function runSelfReview(
  config: SelfReviewConfig,
  workArtifact: string,
  llmFactory: LlmAdapterFactory,
  agentLoader: AgentLoader,
  abortSignal: AbortSignal,
  progress?: SelfReviewProgress,
): Promise<SelfReviewResult> {
  const maxIter = config.maxIterations ?? DEFAULT_SELF_REVIEW_CONFIG.maxIterations!;
  const reviewerMaxIter = config.reviewerMaxIterations ?? DEFAULT_SELF_REVIEW_CONFIG.reviewerMaxIterations!;
  const reviewerBudget = config.reviewerTokenBudget ?? DEFAULT_SELF_REVIEW_CONFIG.reviewerTokenBudget!;
  const reviewerCanWrite = config.reviewerCanWrite ?? DEFAULT_SELF_REVIEW_CONFIG.reviewerCanWrite!;

  const allFindings: ReviewFinding[] = [];
  const addressedFindings: ReviewFinding[] = [];
  let previousNonLowFindings: ReviewFinding[] = [];

  for (let iteration = 1; iteration <= maxIter; iteration++) {
    if (abortSignal.aborted) { break; }

    progress?.onReviewIteration?.(iteration, maxIter);

    // Build the review prompt
    const reviewPrompt = buildReviewPrompt(
      config.role,
      workArtifact,
      iteration > 1 ? previousNonLowFindings : undefined,
    );

    // Spawn reviewer sub-agent (same role, review mode)
    // When reviewerCanWrite is false (default), limit to read-only tools
    // via createMinimalToolRegistry() inside spawnSubAgent.
    const reviewerConfig: SubAgentConfig = {
      role: config.role,
      maxIterations: reviewerMaxIter,
      tokenBudget: reviewerBudget,
      systemPromptOverride: buildReviewerSystemPrompt(config.role),
      workspaceRoot: config.workspaceRoot,
      includeTools: reviewerCanWrite,
    };

    const subResult: SubAgentResult = await spawnSubAgent(
      reviewerConfig,
      reviewPrompt,
      llmFactory,
      agentLoader,
      abortSignal,
    );

    // Parse the review response
    const reviewResult = parseReviewResponse(subResult.response);
    allFindings.push(...reviewResult.findings);

    progress?.onFindingsReceived?.(reviewResult.findings, iteration);

    // Check if approved
    if (reviewResult.approved) {
      progress?.onApproved?.(iteration);
      return {
        approved: true,
        allFindings,
        addressedFindings,
        iterations: iteration,
        summary: `Review approved after ${iteration} iteration(s). `
          + `Total findings: ${allFindings.length} `
          + `(${addressedFindings.length} addressed).`,
      };
    }

    // Filter non-low findings that need addressing
    const nonLow = reviewResult.findings.filter(f => f.impact !== 'low');

    if (nonLow.length === 0) {
      // Only low-impact findings -- approve with notes
      progress?.onApproved?.(iteration);
      return {
        approved: true,
        allFindings,
        addressedFindings,
        iterations: iteration,
        summary: `Review approved after ${iteration} iteration(s) `
          + `(only low-impact findings remain). `
          + `Total findings: ${allFindings.length}.`,
      };
    }

    // Track findings that need to be addressed
    addressedFindings.push(...nonLow);
    previousNonLowFindings = [...nonLow];

    progress?.onAddressingFindings?.(nonLow.length);

    // Build feedback for the main agent -- this is returned so the caller
    // (agenticLoop) can inject it into the main conversation.
    // The loop here controls the iteration count; the actual "fix" happens
    // in the main agentic loop when it receives the feedback.

    // For subsequent iterations, the workArtifact should be updated by the
    // caller to reflect what was fixed. We return early with approval=false.
    if (iteration < maxIter) {
      return {
        approved: false,
        allFindings,
        addressedFindings,
        iterations: iteration,
        summary: buildFindingsFeedback(nonLow, iteration, maxIter),
      };
    }
  }

  // Max iterations reached
  progress?.onMaxIterationsReached?.(maxIter);

  return {
    approved: false,
    allFindings,
    addressedFindings,
    iterations: maxIter,
    summary: `Self-review reached maximum iterations (${maxIter}) without full approval. `
      + `${allFindings.length} total findings, ${addressedFindings.length} addressed.`,
  };
}

/**
 * Get the default self-review config for a given role.
 * All roles use the same defaults; this is a convenience function.
 */
export function getDefaultSelfReviewConfig(
  role: string,
  workspaceRoot: string,
): SelfReviewConfig {
  return {
    maxIterations: DEFAULT_SELF_REVIEW_CONFIG.maxIterations!,
    role,
    workspaceRoot,
    reviewerMaxIterations: DEFAULT_SELF_REVIEW_CONFIG.reviewerMaxIterations!,
    reviewerTokenBudget: DEFAULT_SELF_REVIEW_CONFIG.reviewerTokenBudget!,
    reviewerCanWrite: DEFAULT_SELF_REVIEW_CONFIG.reviewerCanWrite!,
  };
}
