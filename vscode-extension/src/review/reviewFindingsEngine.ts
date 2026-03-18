import * as fs from 'fs';
import {
 extractBullets,
 extractParagraph,
 extractSection,
 findingFilePath,
 listFindingPaths,
 normalizePriority,
 normalizePromotion,
 normalizeSeverity,
 normalizeStatus,
 normalizeType,
 parseFrontmatter,
 parseList,
 saveFinding,
 stripFrontmatter,
 toUniqueLabels,
} from './review-findingsInternals';
import type {
 ReviewFindingIssueDraft,
 ReviewFindingRecord,
} from './review-findingsTypes';

export function loadReviewFindingRecords(root: string): ReviewFindingRecord[] {
 const records: ReviewFindingRecord[] = [];

 for (const relativePath of listFindingPaths(root)) {
  const filePath = findingFilePath(root, relativePath);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const frontmatter = parseFrontmatter(raw);
  if (!frontmatter.id || !frontmatter.title || !frontmatter.source_review) {
   continue;
  }

  const body = stripFrontmatter(raw);
  records.push({
   id: frontmatter.id,
   title: frontmatter.title,
   sourceReview: frontmatter.source_review,
   sourceIssue: frontmatter.source_issue ? Number(frontmatter.source_issue) : undefined,
   severity: normalizeSeverity(frontmatter.severity),
   status: normalizeStatus(frontmatter.status),
   priority: normalizePriority(frontmatter.priority),
   owner: frontmatter.owner || 'unassigned',
   promotion: normalizePromotion(frontmatter.promotion),
   suggestedType: normalizeType(frontmatter.suggested_type),
   labels: parseList(frontmatter.labels),
   dependencies: parseList(frontmatter.dependencies),
   evidence: parseList(frontmatter.evidence),
   backlogIssue: frontmatter.backlog_issue ? Number(frontmatter.backlog_issue) : undefined,
   created: frontmatter.created || '',
   updated: frontmatter.updated || '',
   summary: extractParagraph(extractSection(body, 'Summary')),
   impact: extractBullets(extractSection(body, 'Impact')),
   recommendedAction: extractBullets(extractSection(body, 'Recommended Action')),
   promotionNotes: extractBullets(extractSection(body, 'Promotion Notes')),
   relativePath,
  });
 }

 return records.sort((left, right) => left.id.localeCompare(right.id));
}

export function findReviewFindingById(
 root: string,
 findingId: string,
): ReviewFindingRecord | undefined {
 return loadReviewFindingRecords(root).find(
  (record) => record.id.toLowerCase() === findingId.toLowerCase(),
 );
}

export function getPromotableReviewFindings(root: string): ReviewFindingRecord[] {
 return loadReviewFindingRecords(root).filter(
  (record) => record.promotion !== 'review-only' && !record.backlogIssue,
 );
}

export function buildReviewFindingIssueDraft(record: ReviewFindingRecord): ReviewFindingIssueDraft {
 const labels = toUniqueLabels(record);
 const bodyLines = [
  '## Source Review',
  `- Finding: ${record.id}`,
  `- Review: ${record.sourceReview}`,
  `- Source Issue: ${record.sourceIssue ? `#${record.sourceIssue}` : 'unknown'}`,
  '',
  '## Finding Metadata',
  `- Severity: ${record.severity}`,
  `- Priority: ${record.priority}`,
  `- Owner: ${record.owner}`,
  `- Promotion: ${record.promotion}`,
  '',
  '## Summary',
  record.summary || 'No summary provided.',
  '',
  '## Impact',
  ...(record.impact.length > 0
   ? record.impact.map((item) => `- ${item}`)
   : ['- Impact not captured in the finding record.']),
  '',
  '## Recommended Action',
  ...(record.recommendedAction.length > 0
   ? record.recommendedAction.map((item) => `- ${item}`)
   : ['- Recommended action not captured in the finding record.']),
 ];

 if (record.dependencies.length > 0) {
  bodyLines.push('', '## Dependencies', ...record.dependencies.map((item) => `- ${item}`));
 }

 if (record.evidence.length > 0) {
  bodyLines.push('', '## Evidence Links', ...record.evidence.map((item) => `- ${item}`));
 }

 if (record.promotionNotes.length > 0) {
  bodyLines.push('', '## Promotion Notes', ...record.promotionNotes.map((item) => `- ${item}`));
 }

 return {
  title: `Resolve review finding: ${record.title}`,
  body: bodyLines.join('\n'),
  labels,
 };
}

export function updatePromotedFinding(
 root: string,
 record: ReviewFindingRecord,
 issueNumber: number,
): ReviewFindingRecord {
 const nextRecord: ReviewFindingRecord = {
  ...record,
  backlogIssue: issueNumber,
  status: 'Backlog',
  updated: new Date().toISOString().slice(0, 10),
 };
 saveFinding(root, nextRecord);
 return nextRecord;
}

export function getReviewFindingSummary(root: string | undefined): string {
 if (!root) {
  return 'No findings';
 }
 const records = loadReviewFindingRecords(root);
 const openCount = records.filter((record) => record.status !== 'Done').length;
 return `${openCount} open`;
}

export function getReviewFindingTooltip(root: string | undefined): string {
 if (!root) {
  return 'No workspace open for review findings.';
 }
 const records = loadReviewFindingRecords(root);
 if (records.length === 0) {
  return 'No durable review finding records found under docs/artifacts/reviews/findings.';
 }

 return records
  .map((record) => `${record.id}: ${record.severity}, ${record.status}, ${record.title}`)
  .join('\n');
}

export function getPromotableFindingSummary(root: string | undefined): string {
 if (!root) {
  return 'No findings';
 }
 const records = getPromotableReviewFindings(root);
 return records.length === 0 ? 'none' : `${records.length} ready`;
}

export function getPromotableFindingTooltip(root: string | undefined): string {
 if (!root) {
  return 'No workspace open for review findings.';
 }
 const records = getPromotableReviewFindings(root);
 if (records.length === 0) {
  return 'No promotable review findings detected.';
 }

 return records
  .map((record) => `${record.id}: ${record.priority}, ${record.promotion}, ${record.title}`)
  .join('\n');
}

export function renderReviewFindingsMarkdown(records: ReadonlyArray<ReviewFindingRecord>): string {
 const workflowGuidePath = 'docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md';
 const lines = [
  '**Review Findings**',
  '',
  `Open findings: ${records.filter((record) => record.status !== 'Done').length}`,
  `Promotable findings: ${records.filter((record) => record.promotion !== 'review-only' && !record.backlogIssue).length}`,
  '',
 ];

 if (records.length === 0) {
  lines.push(
   'No durable review findings were found.',
   '',
    `Reference guide: ${workflowGuidePath}`,
   'Template: docs/artifacts/reviews/FINDING-TEMPLATE.md',
  );
  return lines.join('\n');
 }

 for (const record of records) {
  lines.push(`- **${record.id}**: ${record.title}`);
  lines.push(`  Severity: ${record.severity}`);
  lines.push(`  Status: ${record.status}`);
  lines.push(`  Priority: ${record.priority}`);
  lines.push(`  Promotion: ${record.promotion}`);
  lines.push(`  Owner: ${record.owner}`);
  if (record.backlogIssue) {
   lines.push(`  Backlog issue: #${record.backlogIssue}`);
  }
  if (record.summary) {
   lines.push(`  Summary: ${record.summary}`);
  }
  if (record.evidence.length > 0) {
   lines.push(`  Evidence: ${record.evidence.join(', ')}`);
  }
  lines.push(`  Record: ${record.relativePath}`);
  lines.push('');
 }

 lines.push(`Reference guide: ${workflowGuidePath}`);
 return lines.join('\n').trim();
}

export function renderReviewFindingsText(records: ReadonlyArray<ReviewFindingRecord>): string {
 return renderReviewFindingsMarkdown(records).replace(/\*\*/g, '');
}