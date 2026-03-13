export type ReviewFindingSeverity = 'high' | 'medium' | 'low';
export type ReviewFindingStatus = 'Backlog' | 'Ready' | 'In Progress' | 'In Review' | 'Done';
export type ReviewFindingPriority = 'p0' | 'p1' | 'p2' | 'p3';
export type ReviewFindingPromotion = 'review-only' | 'recommended' | 'required';
export type ReviewFindingType = 'bug' | 'story' | 'docs';

export interface ReviewFindingRecord {
  readonly id: string;
  readonly title: string;
  readonly sourceReview: string;
  readonly sourceIssue: number | undefined;
  readonly severity: ReviewFindingSeverity;
  readonly status: ReviewFindingStatus;
  readonly priority: ReviewFindingPriority;
  readonly owner: string;
  readonly promotion: ReviewFindingPromotion;
  readonly suggestedType: ReviewFindingType;
  readonly labels: ReadonlyArray<string>;
  readonly dependencies: ReadonlyArray<string>;
  readonly evidence: ReadonlyArray<string>;
  readonly backlogIssue: number | undefined;
  readonly created: string;
  readonly updated: string;
  readonly summary: string;
  readonly impact: ReadonlyArray<string>;
  readonly recommendedAction: ReadonlyArray<string>;
  readonly promotionNotes: ReadonlyArray<string>;
  readonly relativePath: string;
}

export interface ReviewFindingIssueDraft {
  readonly title: string;
  readonly body: string;
  readonly labels: ReadonlyArray<string>;
}

export interface ReviewFindingPromotionResult {
  readonly finding: ReviewFindingRecord;
  readonly issueNumber: number;
  readonly alreadyPromoted: boolean;
}
