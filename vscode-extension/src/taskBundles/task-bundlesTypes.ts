export type TaskBundleState = 'Proposed' | 'Ready' | 'In Progress' | 'In Review' | 'Done' | 'Archived';
export type TaskBundlePriority = 'p0' | 'p1' | 'p2' | 'p3';
export type TaskBundlePromotionMode = 'none' | 'story_candidate' | 'feature_candidate' | 'review_finding_candidate';
export type TaskBundlePromotionTarget = 'story' | 'feature' | 'review-finding' | 'none';

export interface TaskBundleParentContext {
  readonly issueNumber?: number;
  readonly issueTitle?: string;
  readonly planReference?: string;
  readonly threadId?: string;
  readonly source: string;
}

export interface TaskBundlePromotionHistory {
  readonly promotionDecision: string;
  readonly targetType: string;
  readonly targetReference: string;
  readonly duplicateCheckResult: string;
  readonly searchableStatus: string;
  readonly promotedAt?: string;
}

export interface TaskBundleRecord {
  readonly bundleId: string;
  readonly title: string;
  readonly summary: string;
  readonly parentContext: TaskBundleParentContext;
  readonly priority: TaskBundlePriority;
  readonly state: TaskBundleState;
  readonly owner: string;
  readonly evidenceLinks: ReadonlyArray<string>;
  readonly promotionMode: TaskBundlePromotionMode;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly tags: ReadonlyArray<string>;
  readonly archiveReason?: string;
  readonly promotionHistory?: TaskBundlePromotionHistory;
}

export interface TaskBundleListOptions {
  readonly issue?: number;
  readonly plan?: string;
  readonly state?: TaskBundleState;
  readonly priority?: TaskBundlePriority;
  readonly all?: boolean;
}

export interface TaskBundleCreateInput {
  readonly title: string;
  readonly summary?: string;
  readonly issue?: number;
  readonly plan?: string;
  readonly owner?: string;
  readonly priority?: TaskBundlePriority;
  readonly promotionMode?: TaskBundlePromotionMode;
  readonly evidence?: ReadonlyArray<string>;
  readonly tags?: ReadonlyArray<string>;
}

export interface TaskBundleResolveInput {
  readonly bundleId: string;
  readonly state?: Extract<TaskBundleState, 'Done' | 'Archived'>;
  readonly archiveReason?: string;
}

export interface TaskBundlePromoteInput {
  readonly bundleId: string;
  readonly target?: TaskBundlePromotionTarget;
}

export interface TaskBundlePromotionResult {
  readonly bundle: TaskBundleRecord;
  readonly targetType: string;
  readonly targetReference: string;
  readonly duplicateCheckResult: string;
}