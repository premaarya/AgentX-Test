import * as fs from 'fs';
import * as path from 'path';

import type {
  ReviewFindingPriority,
  ReviewFindingPromotion,
  ReviewFindingRecord,
  ReviewFindingSeverity,
  ReviewFindingStatus,
  ReviewFindingType,
} from './review-findingsTypes';

export const FINDINGS_DIR = path.join('docs', 'artifacts', 'reviews', 'findings');

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return {};
  }

  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    fields[key] = value;
  }
  return fields;
}

export function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

export function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value.split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function extractSection(body: string, heading: string): string {
  const pattern = new RegExp(`^## ${escapeRegExp(heading)}\\s*$([\\s\\S]*?)(?=^##\\s|\\Z)`, 'm');
  const match = body.match(pattern);
  return match ? match[1].trim() : '';
}

export function extractParagraph(section: string): string {
  const value = section.trim();
  if (!value) {
    return '';
  }

  return value.split(/\r?\n\r?\n/)[0].replace(/\r?\n/g, ' ').trim();
}

export function extractBullets(section: string): string[] {
  return section.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

export function findingsRoot(root: string): string {
  return path.join(root, FINDINGS_DIR);
}

export function findingFilePath(root: string, relativePath: string): string {
  return path.join(root, ...relativePath.split('/'));
}

export function listFindingPaths(root: string): string[] {
  const directory = findingsRoot(root);
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory)
    .filter((entry) => /^FINDING-.+\.md$/i.test(entry))
    .map((entry) => `${FINDINGS_DIR.replace(/\\/g, '/')}/${entry}`)
    .sort();
}

export function normalizeStatus(value: string | undefined): ReviewFindingStatus {
  const allowed: ReadonlyArray<ReviewFindingStatus> = ['Backlog', 'Ready', 'In Progress', 'In Review', 'Done'];
  if (value && allowed.includes(value as ReviewFindingStatus)) {
    return value as ReviewFindingStatus;
  }
  return 'Backlog';
}

export function normalizePriority(value: string | undefined): ReviewFindingPriority {
  const allowed: ReadonlyArray<ReviewFindingPriority> = ['p0', 'p1', 'p2', 'p3'];
  if (value && allowed.includes(value as ReviewFindingPriority)) {
    return value as ReviewFindingPriority;
  }
  return 'p2';
}

export function normalizeSeverity(value: string | undefined): ReviewFindingSeverity {
  const allowed: ReadonlyArray<ReviewFindingSeverity> = ['high', 'medium', 'low'];
  if (value && allowed.includes(value as ReviewFindingSeverity)) {
    return value as ReviewFindingSeverity;
  }
  return 'medium';
}

export function normalizePromotion(value: string | undefined): ReviewFindingPromotion {
  const allowed: ReadonlyArray<ReviewFindingPromotion> = ['review-only', 'recommended', 'required'];
  if (value && allowed.includes(value as ReviewFindingPromotion)) {
    return value as ReviewFindingPromotion;
  }
  return 'recommended';
}

export function normalizeType(value: string | undefined): ReviewFindingType {
  const allowed: ReadonlyArray<ReviewFindingType> = ['bug', 'story', 'docs'];
  if (value && allowed.includes(value as ReviewFindingType)) {
    return value as ReviewFindingType;
  }
  return 'story';
}

export function toUniqueLabels(record: ReviewFindingRecord): string[] {
  const labels = [...record.labels];
  if (!labels.some((label) => label.startsWith('type:'))) {
    labels.push(`type:${record.suggestedType}`);
  }
  if (!labels.some((label) => label.startsWith('priority:'))) {
    labels.push(`priority:${record.priority}`);
  }
  return [...new Set(labels)].sort();
}

function serializeList(values: ReadonlyArray<string>): string {
  return values.join(',');
}

export function serializeFinding(record: ReviewFindingRecord): string {
  const lines = [
    '---',
    `id: ${record.id}`,
    `title: ${record.title}`,
    `source_review: ${record.sourceReview}`,
    `source_issue: ${record.sourceIssue ?? ''}`,
    `severity: ${record.severity}`,
    `status: ${record.status}`,
    `priority: ${record.priority}`,
    `owner: ${record.owner}`,
    `promotion: ${record.promotion}`,
    `suggested_type: ${record.suggestedType}`,
    `labels: ${serializeList(record.labels)}`,
    `dependencies: ${serializeList(record.dependencies)}`,
    `evidence: ${serializeList(record.evidence)}`,
    `backlog_issue: ${record.backlogIssue ?? ''}`,
    `created: ${record.created}`,
    `updated: ${record.updated}`,
    '---',
    '',
    `# Review Finding: ${record.title}`,
    '',
    '## Summary',
    '',
    record.summary || '{Add summary.}',
    '',
    '## Impact',
    '',
    ...(record.impact.length > 0 ? record.impact.map((item) => `- ${item}`) : ['- {Add impact.}']),
    '',
    '## Recommended Action',
    '',
    ...(record.recommendedAction.length > 0
      ? record.recommendedAction.map((item) => `- ${item}`)
      : ['- {Add recommended action.}']),
    '',
    '## Promotion Notes',
    '',
    ...(record.promotionNotes.length > 0
      ? record.promotionNotes.map((item) => `- ${item}`)
      : ['- {Add promotion notes.}']),
    '',
  ];

  return lines.join('\n');
}

export function saveFinding(root: string, record: ReviewFindingRecord): void {
  const filePath = findingFilePath(root, record.relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, serializeFinding(record), 'utf-8');
}

export function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}
