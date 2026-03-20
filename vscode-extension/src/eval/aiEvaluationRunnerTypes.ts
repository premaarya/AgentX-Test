import type {
  AIEvaluationReport,
  AIEvaluationRunnerKind,
  AIEvaluationRunnerSelection,
  AIEvaluationWorkspaceState,
  AIEvaluationWorkflowIntent,
} from './aiEvaluationContractTypes';

export interface AIEvaluationExecutionBlocker {
  readonly code: string;
  readonly message: string;
}

export interface AIEvaluationExecutionPlan {
  readonly runId: string;
  readonly root: string;
  readonly manifestPath: string;
  readonly workflow: AIEvaluationWorkflowIntent;
  readonly runner: AIEvaluationRunnerSelection;
  readonly reportDirectory: string;
  readonly retainRawOutputs: boolean;
  readonly models: ReadonlyArray<string>;
  readonly datasets: ReadonlyArray<string>;
  readonly metrics: ReadonlyArray<string>;
  readonly baselineRunId?: string;
}

export interface AIEvaluationExecutionPlanningResult {
  readonly ready: boolean;
  readonly contract: AIEvaluationWorkspaceState;
  readonly plan?: AIEvaluationExecutionPlan;
  readonly blockers: ReadonlyArray<AIEvaluationExecutionBlocker>;
}

export interface AIEvaluationRawMetricScore {
  readonly metric: string;
  readonly score: number;
}

export interface AIEvaluationRawFailureSlice {
  readonly label: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly summary: string;
  readonly dataset?: string;
}

export interface AIEvaluationRawSafetySummary {
  readonly criticalCount?: number;
  readonly highCount?: number;
  readonly summary?: string;
}

export interface AIEvaluationRawCostAndLatency {
  readonly totalCostUsd?: number;
  readonly avgLatencyMs?: number;
}

export interface AIEvaluationRawOutput {
  readonly runId?: string;
  readonly generatedAt?: string;
  readonly models?: ReadonlyArray<string>;
  readonly datasetCount?: number;
  readonly aggregateMetrics: ReadonlyArray<AIEvaluationRawMetricScore>;
  readonly failureSlices?: ReadonlyArray<AIEvaluationRawFailureSlice>;
  readonly safetySummary?: AIEvaluationRawSafetySummary;
  readonly costAndLatency?: AIEvaluationRawCostAndLatency;
  readonly reviewerNote?: string;
}

export interface AIEvaluationExecutionContext {
  readonly contract: AIEvaluationWorkspaceState;
  readonly plan: AIEvaluationExecutionPlan;
}

export interface AIEvaluationExecutionStreamOptions {
  readonly onLine?: (line: string, source: 'stdout' | 'stderr') => void;
}

export interface AIEvaluationRunnerAdapter {
  readonly runner: AIEvaluationRunnerKind | 'any';
  execute(
    context: AIEvaluationExecutionContext,
    options?: AIEvaluationExecutionStreamOptions,
  ): Promise<AIEvaluationRawOutput>;
}

export interface AIEvaluationExecutionOptions extends AIEvaluationExecutionStreamOptions {
  readonly adapters: ReadonlyArray<AIEvaluationRunnerAdapter>;
}

export interface AIEvaluationExecutionResult {
  readonly plan: AIEvaluationExecutionPlan;
  readonly report: AIEvaluationReport;
  readonly reportPath: string;
  readonly rawOutputPath?: string;
}

export interface ShellAIEvaluationCommand {
  readonly command: string;
  readonly shell?: 'pwsh' | 'bash';
  readonly envOverrides?: NodeJS.ProcessEnv;
}