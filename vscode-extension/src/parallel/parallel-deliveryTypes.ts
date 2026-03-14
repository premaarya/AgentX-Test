export type ParallelDecision = 'eligible' | 'ineligible';

export interface ParallelAssessment {
  readonly scopeIndependence: string;
  readonly dependencyCoupling: string;
  readonly artifactOverlap: string;
  readonly reviewComplexity: string;
  readonly recoveryComplexity: string;
  readonly decision: ParallelDecision;
  readonly requiredReviewLevel: string;
}

export interface ParallelTaskUnit {
  readonly unitId: string;
  readonly title: string;
  readonly scopeBoundary: string;
  readonly owner: string;
  readonly isolationMode: string;
  readonly status: string;
  readonly mergeReadiness: string;
  readonly recoveryGuidance: string;
  readonly summarySignal: string;
}

export interface ParallelReconciliation {
  readonly state: string;
  readonly overlapReview: string;
  readonly conflictReview: string;
  readonly acceptanceEvidence: string;
  readonly ownerApproval: string;
  readonly followUpDisposition: string;
  readonly followUpReferences: ReadonlyArray<string>;
  readonly finalDecision: string;
}

export interface ParallelParentSummary {
  readonly unitCount: number;
  readonly blockedCount: number;
  readonly readyForReconciliationCount: number;
  readonly summaryState: string;
  readonly closeoutReady: boolean;
}

export interface BoundedParallelRun {
  readonly parallelId: string;
  readonly title: string;
  readonly mode: string;
  readonly priority: string;
  readonly parentContext: {
    readonly issueNumber?: number;
    readonly issueTitle?: string;
    readonly planReference?: string;
    readonly threadId?: string;
    readonly source: string;
  };
  readonly assessment: ParallelAssessment;
  readonly units: ReadonlyArray<ParallelTaskUnit>;
  readonly reconciliation: ParallelReconciliation;
  readonly parentSummary: ParallelParentSummary;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ParallelAssessInput {
  readonly title?: string;
  readonly issue?: number;
  readonly plan?: string;
  readonly scopeIndependence: string;
  readonly dependencyCoupling: string;
  readonly artifactOverlap: string;
  readonly reviewComplexity: string;
  readonly recoveryComplexity: string;
}

export interface ParallelStartInput {
  readonly parallelId: string;
  readonly units: ReadonlyArray<{
    readonly title: string;
    readonly scopeBoundary: string;
    readonly owner: string;
    readonly isolationMode?: string;
    readonly status?: string;
    readonly mergeReadiness?: string;
    readonly recoveryGuidance: string;
    readonly summarySignal?: string;
  }>;
}

export interface ParallelReconcileInput {
  readonly parallelId: string;
  readonly overlapReview: string;
  readonly conflictReview: string;
  readonly acceptanceEvidence: string;
  readonly ownerApproval: string;
  readonly followUpTarget?: 'story' | 'feature' | 'review-finding';
  readonly followUpTitle?: string;
  readonly followUpSummary?: string;
}