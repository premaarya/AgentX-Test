export type AIEvaluationWorkflowIntent = 'prompt' | 'rag' | 'agentic' | 'multimodal' | 'hybrid';
export type AIEvaluationRunnerKind = 'promptfoo' | 'azure-ai-evaluation' | 'custom';
export type AIEvaluationRunnerMode = 'local' | 'remote' | 'hybrid';
export type AIEvaluationExecutionShell = 'pwsh' | 'bash';
export type AIEvaluationSeverity = 'error' | 'warning';
export type AIEvaluationGateStatus = 'pass' | 'warn' | 'fail';
export type AIEvaluationMetricStatus = 'pass' | 'warn' | 'fail' | 'missing';
export type AIEvaluationDeltaDirection = 'improved' | 'regressed' | 'unchanged';

export interface AIEvaluationModelRef {
  readonly name: string;
  readonly provider?: string;
  readonly version?: string;
}

export interface AIEvaluationDatasetRef {
  readonly name: string;
  readonly path: string;
  readonly purpose: string;
  readonly coverageType: string;
  readonly rowCount?: number;
  readonly dataFormat?: string;
}

export interface AIEvaluationThreshold {
  readonly metric: string;
  readonly blocking?: number;
  readonly warning?: number;
}

export interface AIEvaluationRubricRef {
  readonly metric: string;
  readonly path: string;
  readonly judgeType?: string;
  readonly scoringScale?: string;
  readonly calibrationRule?: string;
}

export interface AIEvaluationReportPolicy {
  readonly outputDirectory: string;
  readonly formatVersion: number;
  readonly retainRawOutputs?: boolean;
}

export interface AIEvaluationExecutionConfig {
  readonly command?: string;
  readonly shell?: AIEvaluationExecutionShell;
}

export interface AIEvaluationManifest {
  readonly version: number;
  readonly intent: {
    readonly workflow: AIEvaluationWorkflowIntent;
    readonly description?: string;
  };
  readonly runner: {
    readonly preferred: AIEvaluationRunnerKind;
    readonly alternates: ReadonlyArray<AIEvaluationRunnerKind>;
    readonly mode: AIEvaluationRunnerMode;
    readonly remoteHost?: string;
  };
  readonly modelMatrix: {
    readonly primary: AIEvaluationModelRef;
    readonly fallback: ReadonlyArray<AIEvaluationModelRef>;
    readonly comparisons: ReadonlyArray<AIEvaluationModelRef>;
  };
  readonly datasets: ReadonlyArray<AIEvaluationDatasetRef>;
  readonly metrics: ReadonlyArray<string>;
  readonly thresholds: ReadonlyArray<AIEvaluationThreshold>;
  readonly rubrics: ReadonlyArray<AIEvaluationRubricRef>;
  readonly reporting: AIEvaluationReportPolicy;
  readonly execution?: AIEvaluationExecutionConfig;
}

export interface AIEvaluationBaseline {
  readonly version: number;
  readonly acceptedRunId: string;
  readonly updatedAt: string;
  readonly runner: AIEvaluationRunnerKind;
  readonly model: string;
  readonly aggregateScores: Readonly<Record<string, number>>;
  readonly thresholdSnapshot: Readonly<Record<string, Readonly<{
    blocking?: number;
    warning?: number;
  }>>>;
}

export interface AIEvaluationMetricResult {
  readonly metric: string;
  readonly score: number;
  readonly blocking?: number;
  readonly warning?: number;
  readonly status: AIEvaluationMetricStatus;
}

export interface AIEvaluationRegressionDelta {
  readonly metric: string;
  readonly delta: number;
  readonly direction: AIEvaluationDeltaDirection;
}

export interface AIEvaluationFailureSlice {
  readonly label: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly summary: string;
  readonly dataset?: string;
}

export interface AIEvaluationReport {
  readonly version: number;
  readonly runId: string;
  readonly generatedAt: string;
  readonly runner: AIEvaluationRunnerKind;
  readonly status: AIEvaluationGateStatus;
  readonly summary: {
    readonly models: ReadonlyArray<string>;
    readonly datasetCount: number;
    readonly pass: boolean;
  };
  readonly aggregateMetrics: ReadonlyArray<AIEvaluationMetricResult>;
  readonly regression?: {
    readonly baselineRunId?: string;
    readonly status: 'improved' | 'stable' | 'regressed' | 'unknown';
    readonly deltas: ReadonlyArray<AIEvaluationRegressionDelta>;
  };
  readonly failureSlices: ReadonlyArray<AIEvaluationFailureSlice>;
  readonly safetySummary?: {
    readonly criticalCount: number;
    readonly highCount: number;
    readonly summary?: string;
  };
  readonly costAndLatency?: {
    readonly totalCostUsd?: number;
    readonly avgLatencyMs?: number;
  };
  readonly reviewerNote: string;
}

export interface AIEvaluationIssue {
  readonly code: string;
  readonly severity: AIEvaluationSeverity;
  readonly message: string;
  readonly filePath?: string;
}

export interface AIEvaluationRunnerSelection {
  readonly preferred: AIEvaluationRunnerKind;
  readonly alternates: ReadonlyArray<AIEvaluationRunnerKind>;
  readonly mode: AIEvaluationRunnerMode;
  readonly remoteHost?: string;
}

export interface AIEvaluationWorkspaceState {
  readonly contractPresent: boolean;
  readonly contractReady: boolean;
  readonly resultsPresent: boolean;
  readonly manifestPath?: string;
  readonly baselinePath?: string;
  readonly latestReportPath?: string;
  readonly manifest?: AIEvaluationManifest;
  readonly baseline?: AIEvaluationBaseline;
  readonly latestReport?: AIEvaluationReport;
  readonly runnerSelection?: AIEvaluationRunnerSelection;
  readonly issues: ReadonlyArray<AIEvaluationIssue>;
}