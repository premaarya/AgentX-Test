import type {
  BoundedParallelRun,
  ParallelAssessInput,
  ParallelReconcileInput,
  ParallelStartInput,
} from './parallel-deliveryTypes';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

export function parseBoundedParallelRun(output: string): BoundedParallelRun {
  const parsed = JSON.parse(output) as Record<string, unknown>;
  const parentContext = (parsed.parent_context ?? {}) as Record<string, unknown>;
  const assessment = (parsed.assessment ?? {}) as Record<string, unknown>;
  const reconciliation = (parsed.reconciliation ?? {}) as Record<string, unknown>;
  const parentSummary = (parsed.parent_summary ?? {}) as Record<string, unknown>;

  return {
    parallelId: asString(parsed.parallel_id),
    title: asString(parsed.title),
    mode: asString(parsed.mode),
    priority: asString(parsed.priority),
    parentContext: {
      issueNumber: asNumber(parentContext.issue_number),
      issueTitle: asString(parentContext.issue_title) || undefined,
      planReference: asString(parentContext.plan_reference) || undefined,
      threadId: asString(parentContext.thread_id) || undefined,
      source: asString(parentContext.source, 'unknown'),
    },
    assessment: {
      scopeIndependence: asString(assessment.scope_independence),
      dependencyCoupling: asString(assessment.dependency_coupling),
      artifactOverlap: asString(assessment.artifact_overlap),
      reviewComplexity: asString(assessment.review_complexity),
      recoveryComplexity: asString(assessment.recovery_complexity),
      decision: asString(assessment.decision, 'ineligible') as BoundedParallelRun['assessment']['decision'],
      requiredReviewLevel: asString(assessment.required_review_level),
    },
    units: asArray<Record<string, unknown>>(parsed.units).map((unit) => ({
      unitId: asString(unit.unit_id),
      title: asString(unit.title),
      scopeBoundary: asString(unit.scope_boundary),
      owner: asString(unit.owner),
      isolationMode: asString(unit.isolation_mode),
      status: asString(unit.status),
      mergeReadiness: asString(unit.merge_readiness),
      recoveryGuidance: asString(unit.recovery_guidance),
      summarySignal: asString(unit.summary_signal),
    })),
    reconciliation: {
      state: asString(reconciliation.state),
      overlapReview: asString(reconciliation.overlap_review),
      conflictReview: asString(reconciliation.conflict_review),
      acceptanceEvidence: asString(reconciliation.acceptance_evidence),
      ownerApproval: asString(reconciliation.owner_approval),
      followUpDisposition: asString(reconciliation.follow_up_disposition),
      followUpReferences: asStringArray(reconciliation.follow_up_references),
      finalDecision: asString(reconciliation.final_decision),
    },
    parentSummary: {
      unitCount: asNumber(parentSummary.unit_count) ?? 0,
      blockedCount: asNumber(parentSummary.blocked_count) ?? 0,
      readyForReconciliationCount: asNumber(parentSummary.ready_for_reconciliation_count) ?? 0,
      summaryState: asString(parentSummary.summary_state),
      closeoutReady: Boolean(parentSummary.closeout_ready),
    },
    createdAt: asString(parsed.created_at),
    updatedAt: asString(parsed.updated_at),
  };
}

export function parseBoundedParallelRuns(output: string): BoundedParallelRun[] {
  const parsed = JSON.parse(output) as unknown;
  return Array.isArray(parsed) ? parsed.map((entry) => parseBoundedParallelRun(JSON.stringify(entry))) : [];
}

export function renderBoundedParallelRunsText(runs: ReadonlyArray<BoundedParallelRun>): string {
  if (runs.length === 0) {
    return 'No bounded parallel runs found.';
  }
  return runs.map((run) => [
    `${run.parallelId} [${run.assessment.decision}] ${run.title}`,
    `  Parent: ${run.parentContext.issueNumber ? `#${run.parentContext.issueNumber}` : (run.parentContext.planReference ?? 'no-scope')}`,
    `  Summary: ${run.parentSummary.summaryState}`,
    `  Reconciliation: ${run.reconciliation.finalDecision}`,
    `  Units: ${run.parentSummary.unitCount}`,
  ].join('\n')).join('\n\n');
}

export function buildAssessArgs(input: ParallelAssessInput): string[] {
  const args = ['assess', '--json', '--scope-independence', input.scopeIndependence, '--dependency-coupling', input.dependencyCoupling, '--artifact-overlap', input.artifactOverlap, '--review-complexity', input.reviewComplexity, '--recovery-complexity', input.recoveryComplexity];
  if (input.title) {
    args.push('--title-base64', Buffer.from(input.title, 'utf8').toString('base64'));
  }
  if (input.issue) {
    args.push('--issue', String(input.issue));
  }
  if (input.plan) {
    args.push('--plan', input.plan);
  }
  return args;
}

export function buildStartArgs(input: ParallelStartInput): string[] {
  const cliUnits = input.units.map((unit) => ({
    title: unit.title,
    scope_boundary: unit.scopeBoundary,
    owner: unit.owner,
    isolation_mode: unit.isolationMode,
    status: unit.status,
    merge_readiness: unit.mergeReadiness,
    recovery_guidance: unit.recoveryGuidance,
    summary_signal: unit.summarySignal,
  }));
  return ['start', '--id', input.parallelId, '--units-base64', Buffer.from(JSON.stringify(cliUnits), 'utf8').toString('base64'), '--json'];
}

export function buildReconcileArgs(input: ParallelReconcileInput): string[] {
  const args = ['reconcile', '--id', input.parallelId, '--overlap-review', input.overlapReview, '--conflict-review', input.conflictReview, '--acceptance-evidence', input.acceptanceEvidence, '--owner-approval', input.ownerApproval, '--json'];
  if (input.followUpTarget) {
    args.push('--follow-up-target', input.followUpTarget);
  }
  if (input.followUpTitle) {
    args.push('--follow-up-title-base64', Buffer.from(input.followUpTitle, 'utf8').toString('base64'));
  }
  if (input.followUpSummary) {
    args.push('--follow-up-summary-base64', Buffer.from(input.followUpSummary, 'utf8').toString('base64'));
  }
  return args;
}