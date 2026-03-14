import type {
  TaskBundleListOptions,
  TaskBundlePromotionResult,
  TaskBundleRecord,
} from './task-bundlesTypes';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export function parseTaskBundleRecord(value: unknown): TaskBundleRecord {
  const record = (value ?? {}) as Record<string, unknown>;
  const parentContext = (record.parent_context ?? {}) as Record<string, unknown>;
  const promotionHistory = record.promotion_history as Record<string, unknown> | undefined;

  return {
    bundleId: asString(record.bundle_id),
    title: asString(record.title),
    summary: asString(record.summary),
    parentContext: {
      issueNumber: asNumber(parentContext.issue_number),
      issueTitle: asString(parentContext.issue_title) || undefined,
      planReference: asString(parentContext.plan_reference) || undefined,
      threadId: asString(parentContext.thread_id) || undefined,
      source: asString(parentContext.source, 'unknown'),
    },
    priority: asString(record.priority, 'p1') as TaskBundleRecord['priority'],
    state: asString(record.state, 'Ready') as TaskBundleRecord['state'],
    owner: asString(record.owner, 'unassigned'),
    evidenceLinks: asStringArray(record.evidence_links),
    promotionMode: asString(record.promotion_mode, 'none') as TaskBundleRecord['promotionMode'],
    createdAt: asString(record.created_at),
    updatedAt: asString(record.updated_at),
    tags: asStringArray(record.tags),
    archiveReason: asString(record.archive_reason) || undefined,
    promotionHistory: promotionHistory
      ? {
          promotionDecision: asString(promotionHistory.promotion_decision),
          targetType: asString(promotionHistory.target_type),
          targetReference: asString(promotionHistory.target_reference),
          duplicateCheckResult: asString(promotionHistory.duplicate_check_result),
          searchableStatus: asString(promotionHistory.searchable_status),
          promotedAt: asString(promotionHistory.promoted_at) || undefined,
        }
      : undefined,
  };
}

export function parseTaskBundleRecords(output: string): TaskBundleRecord[] {
  const parsed = JSON.parse(output) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.map(parseTaskBundleRecord);
}

export function parseTaskBundle(output: string): TaskBundleRecord {
  return parseTaskBundleRecord(JSON.parse(output) as unknown);
}

export function parseTaskBundlePromotionResult(output: string): TaskBundlePromotionResult {
  const parsed = JSON.parse(output) as Record<string, unknown>;
  return {
    bundle: parseTaskBundleRecord(parsed.bundle),
    targetType: asString(parsed.targetType),
    targetReference: asString(parsed.targetReference),
    duplicateCheckResult: asString(parsed.duplicateCheckResult),
  };
}

export function buildTaskBundleListArgs(options: TaskBundleListOptions = {}): string[] {
  const args: string[] = ['list'];
  if (options.issue) {
    args.push('--issue', String(options.issue));
  }
  if (options.plan) {
    args.push('--plan', options.plan);
  }
  if (options.state) {
    args.push('--state', options.state);
  }
  if (options.priority) {
    args.push('--priority', options.priority);
  }
  if (options.all) {
    args.push('--all');
  }
  args.push('--json');
  return args;
}

export function renderTaskBundlesText(records: ReadonlyArray<TaskBundleRecord>): string {
  if (records.length === 0) {
    return 'No task bundles found.';
  }

  return records
    .map((record) => {
      const scope = record.parentContext.issueNumber
        ? `#${record.parentContext.issueNumber}`
        : (record.parentContext.planReference ?? 'no-scope');
      const lines = [
        `${record.bundleId} [${record.state}] ${record.priority} ${record.title}`,
        `  Scope: ${scope}`,
        `  Owner: ${record.owner}`,
        `  Promotion: ${record.promotionMode}`,
      ];
      if (record.summary) {
        lines.push(`  Summary: ${record.summary}`);
      }
      if (record.promotionHistory?.targetReference) {
        lines.push(`  Target: ${record.promotionHistory.targetReference} (${record.promotionHistory.duplicateCheckResult})`);
      }
      if (record.archiveReason) {
        lines.push(`  Archive: ${record.archiveReason}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}