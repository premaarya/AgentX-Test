export type HarnessThreadStatus = 'active' | 'complete' | 'cancelled' | 'blocked' | 'waiting-approval';
export type HarnessTurnStatus = 'active' | 'complete' | 'cancelled';
export type HarnessItemType = 'command' | 'iteration' | 'status' | 'summary' | 'approval';
export type HarnessEvidenceType = 'loop-output' | 'iteration-summary' | 'status-check' | 'completion';
export type HarnessContractStatus = 'Proposed' | 'Active' | 'Blocked' | 'Complete' | 'Superseded';
export type HarnessContractFindingSeverity = 'high' | 'medium' | 'low';

export interface HarnessThread {
  readonly id: string;
  readonly title: string;
  readonly taskType: string;
  readonly status: HarnessThreadStatus;
  readonly issueNumber?: number | null;
  readonly planPath?: string;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly currentTurnId?: string;
}

export interface HarnessTurn {
  readonly id: string;
  readonly threadId: string;
  readonly sequence: number;
  readonly status: HarnessTurnStatus;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly summary?: string;
}

export interface HarnessItem {
  readonly id: string;
  readonly threadId: string;
  readonly turnId?: string;
  readonly itemType: HarnessItemType;
  readonly summary: string;
  readonly createdAt: string;
  readonly metadata?: Record<string, string | number | boolean | null>;
}

export interface HarnessEvidence {
  readonly id: string;
  readonly threadId: string;
  readonly turnId?: string;
  readonly evidenceType: HarnessEvidenceType;
  readonly summary: string;
  readonly createdAt: string;
}

export interface HarnessContract {
  readonly id: string;
  readonly threadId: string;
  readonly turnId?: string;
  readonly contractPath: string;
  readonly evidencePath?: string;
  readonly status: HarnessContractStatus;
  readonly title: string;
  readonly summary?: string;
  readonly nextAction?: string;
  readonly blocker?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HarnessContractFinding {
  readonly id: string;
  readonly contractId: string;
  readonly threadId: string;
  readonly turnId?: string;
  readonly severity: HarnessContractFindingSeverity;
  readonly summary: string;
  readonly nextAction: string;
  readonly createdAt: string;
}

export interface HarnessState {
  readonly version: 1;
  readonly threads: ReadonlyArray<HarnessThread>;
  readonly turns: ReadonlyArray<HarnessTurn>;
  readonly items: ReadonlyArray<HarnessItem>;
  readonly evidence: ReadonlyArray<HarnessEvidence>;
  readonly contracts: ReadonlyArray<HarnessContract>;
  readonly contractFindings: ReadonlyArray<HarnessContractFinding>;
}

export interface StartHarnessThreadOptions {
  readonly taskType: string;
  readonly title: string;
  readonly prompt?: string;
  readonly completionCriteria?: string;
  readonly issueNumber?: number | null;
  readonly planPath?: string;
}

export interface CompleteHarnessThreadOptions {
  readonly status: Extract<HarnessThreadStatus, 'complete' | 'cancelled' | 'blocked'>;
  readonly summary: string;
}

export interface SetHarnessContractStateOptions {
  readonly contractPath: string;
  readonly evidencePath?: string;
  readonly status: HarnessContractStatus;
  readonly title: string;
  readonly summary?: string;
  readonly nextAction?: string;
  readonly blocker?: string;
}

export interface AddHarnessContractFindingOptions {
  readonly contractPath: string;
  readonly severity: HarnessContractFindingSeverity;
  readonly summary: string;
  readonly nextAction: string;
}
