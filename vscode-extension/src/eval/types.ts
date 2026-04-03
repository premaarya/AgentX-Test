export type EvaluationPillar = 'planning' | 'execution' | 'evidence';
export type ObservationMode = 'observed' | 'reconstructed' | 'inferred';
export type EvaluationAttribution = 'harness' | 'policy' | 'environment' | 'model' | 'unknown' | 'clear';
export type EvaluationDimension = 'workflowCompliance' | 'evidenceStrength' | 'outputConfidence';

export interface ArtifactObservation {
  readonly id: string;
  readonly label: string;
  readonly mode: ObservationMode;
  readonly present: boolean;
  readonly detail: string;
}

export interface EvaluationCheckResult {
  readonly id: string;
  readonly dimension: EvaluationDimension;
  readonly pillar: EvaluationPillar;
  readonly label: string;
  readonly passed: boolean;
  readonly score: number;
  readonly maxScore: number;
  readonly attribution: EvaluationAttribution;
  readonly summary: string;
}

export interface EvaluationScore {
  readonly earned: number;
  readonly max: number;
  readonly percent: number;
  readonly passedChecks: number;
  readonly totalChecks: number;
}

export interface ObservationCoverage {
  readonly observed: number;
  readonly total: number;
  readonly percent: number;
}

export interface EvaluationScores {
  readonly workflowCompliance: EvaluationScore;
  readonly evidenceStrength: EvaluationScore;
  readonly outputConfidence: EvaluationScore;
}

export interface EvaluationReport {
  readonly scores: EvaluationScores;
  readonly dominantAttribution: EvaluationAttribution;
  readonly coverage: ObservationCoverage;
  readonly observations: ReadonlyArray<ArtifactObservation>;
  readonly checks: ReadonlyArray<EvaluationCheckResult>;
}