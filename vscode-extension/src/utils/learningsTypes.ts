export type LearningsIntent = 'planning' | 'review' | 'capture';
export type LearningValidationState = 'draft' | 'reviewed' | 'approved' | 'superseded' | 'archived';
export type LearningEvidenceStrength = 'low' | 'medium' | 'high';

export interface LearningRecord {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly subcategory: string;
  readonly phases: ReadonlyArray<string>;
  readonly validation: LearningValidationState;
  readonly evidence: LearningEvidenceStrength;
  readonly mode: string;
  readonly keywords: ReadonlyArray<string>;
  readonly sources: ReadonlyArray<string>;
  readonly summary: string;
  readonly guidance: ReadonlyArray<string>;
  readonly useWhen: ReadonlyArray<string>;
  readonly avoid: ReadonlyArray<string>;
  readonly relativePath: string;
  readonly updatedAt: number;
}

export interface RankedLearning extends LearningRecord {
  readonly score: number;
  readonly matchedSignals: ReadonlyArray<string>;
  readonly rationale: string;
}

export interface LearningCaptureTarget {
  readonly issueNumber?: number;
  readonly title: string;
  readonly taskType?: string;
  readonly planPath?: string;
}
