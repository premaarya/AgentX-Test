import * as fs from 'fs';
import * as path from 'path';
import { readHarnessState } from '../utils/harnessState';
import { checkHandoffGate, readLoopState } from '../utils/loopStateChecker';
import {
 ArtifactObservation,
 EvaluationAttribution,
 EvaluationCheckResult,
 EvaluationReport,
 EvaluationScore,
} from './types';

interface CheckContext {
 readonly root: string;
 readonly observations: ReadonlyArray<ArtifactObservation>;
 readonly planFiles: ReadonlyArray<string>;
 readonly progressFiles: ReadonlyArray<string>;
 readonly handoffAllowed: boolean;
 readonly handoffReason: string;
 readonly harnessThreadCount: number;
 readonly harnessEvidenceCount: number;
 readonly coveragePercent: number;
 readonly loopHistoryCount: number;
}

export interface HarnessEvaluationInput {
 readonly root: string;
 readonly planFiles: ReadonlyArray<string>;
 readonly loopStatePath: string | undefined;
 readonly harnessStatePath: string | undefined;
}

interface HarnessPolicy {
 readonly disabledChecks: ReadonlySet<string>;
}

function fileExists(filePath: string | undefined): boolean {
 return !!filePath && fs.existsSync(filePath);
}

function countMarkdownFiles(dirPath: string): string[] {
 if (!fs.existsSync(dirPath)) {
  return [];
 }

 return fs.readdirSync(dirPath, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
  .map((entry) => entry.name)
  .sort();
}

function formatCount(label: string, count: number): string {
 return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function readHarnessPolicy(root: string): HarnessPolicy {
 const configPath = path.join(root, '.agentx', 'config.json');
 if (!fs.existsSync(configPath)) {
  return { disabledChecks: new Set<string>() };
 }

 try {
  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
   harness?: { disabledChecks?: unknown };
   harnessDisabledChecks?: unknown;
  };
  const rawValue = parsed.harness?.disabledChecks ?? parsed.harnessDisabledChecks;
  const disabledChecks = new Set<string>();

  if (Array.isArray(rawValue)) {
   for (const entry of rawValue) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
     disabledChecks.add(entry.trim().toLowerCase());
    }
   }
  } else if (typeof rawValue === 'string') {
   for (const entry of rawValue.split(/[;,\r\n]+/)) {
    const normalized = entry.trim().toLowerCase();
    if (normalized.length > 0) {
     disabledChecks.add(normalized);
    }
   }
  }

  return { disabledChecks };
 } catch {
  return { disabledChecks: new Set<string>() };
 }
}

function buildObservations(
 input: HarnessEvaluationInput,
 harnessThreadCount: number,
 harnessEvidenceCount: number,
 loopHistoryCount: number,
): {
 readonly observations: ReadonlyArray<ArtifactObservation>;
 readonly progressFiles: ReadonlyArray<string>;
} {
 const progressDir = path.join(input.root, 'docs', 'execution', 'progress');
 const progressFiles = countMarkdownFiles(progressDir).map((name) => `docs/execution/progress/${name}`);

 const observations: ArtifactObservation[] = [
  {
   id: 'execution-plan',
   label: 'Execution plan',
   mode: input.planFiles.length > 0 ? 'observed' : 'inferred',
   present: input.planFiles.length > 0,
   detail: input.planFiles.length > 0
    ? `${formatCount('plan file', input.planFiles.length)} discovered`
    : 'No execution plans discovered',
  },
  {
   id: 'progress-log',
   label: 'Progress log',
   mode: progressFiles.length > 0 ? 'observed' : 'inferred',
   present: progressFiles.length > 0,
   detail: progressFiles.length > 0
    ? `${formatCount('progress log', progressFiles.length)} discovered`
    : 'No progress log found under docs/execution/progress',
  },
  {
   id: 'loop-state',
   label: 'Loop state',
   mode: fileExists(input.loopStatePath) ? 'observed' : 'inferred',
   present: fileExists(input.loopStatePath),
   detail: fileExists(input.loopStatePath)
    ? 'Loop state file observed'
    : 'Loop state file missing',
  },
  {
   id: 'harness-state',
   label: 'Harness state',
   mode: fileExists(input.harnessStatePath) ? 'observed' : 'inferred',
   present: fileExists(input.harnessStatePath),
   detail: fileExists(input.harnessStatePath)
    ? 'Harness state file observed'
    : 'Harness state file missing',
  },
  {
   id: 'harness-thread',
   label: 'Harness thread',
   mode: harnessThreadCount > 0 ? 'observed' : 'inferred',
   present: harnessThreadCount > 0,
   detail: harnessThreadCount > 0
    ? `${formatCount('thread', harnessThreadCount)} recorded in harness state`
    : 'No harness thread recorded',
  },
  {
   id: 'captured-evidence',
   label: 'Captured evidence',
   mode: harnessEvidenceCount > 0 ? 'observed' : 'inferred',
   present: harnessEvidenceCount > 0,
   detail: harnessEvidenceCount > 0
    ? `${formatCount('evidence item', harnessEvidenceCount)} recorded in harness state`
    : 'No captured evidence recorded',
  },
  {
   id: 'loop-history',
   label: 'Loop history',
   mode: loopHistoryCount > 0 ? 'observed' : 'inferred',
   present: loopHistoryCount > 0,
   detail: loopHistoryCount > 0
    ? `${formatCount('iteration entry', loopHistoryCount)} available in loop history`
    : 'No loop history entries recorded',
  },
 ];

 return { observations, progressFiles };
}

function buildScore(checks: ReadonlyArray<EvaluationCheckResult>): EvaluationScore {
 const earned = checks.reduce((sum, check) => sum + check.score, 0);
 const max = checks.reduce((sum, check) => sum + check.maxScore, 0);
 return {
  earned,
  max,
  percent: max === 0 ? 0 : Math.round((earned / max) * 100),
  passedChecks: checks.filter((check) => check.passed).length,
  totalChecks: checks.length,
 };
}

function buildWorkflowChecks(context: CheckContext): ReadonlyArray<EvaluationCheckResult> {
 return [
  {
   id: 'execution-plan-present',
   dimension: 'workflowCompliance',
   pillar: 'planning',
   label: 'Execution plan linked',
   passed: context.planFiles.length > 0,
   score: context.planFiles.length > 0 ? 25 : 0,
   maxScore: 25,
   attribution: context.planFiles.length > 0 ? 'clear' : 'harness',
   summary: context.planFiles.length > 0
    ? `${formatCount('plan file', context.planFiles.length)} available for evaluation`
    : 'No execution plan found for the current workspace',
  },
  {
   id: 'progress-log-present',
   dimension: 'workflowCompliance',
   pillar: 'planning',
   label: 'Progress log tracked',
   passed: context.progressFiles.length > 0,
   score: context.progressFiles.length > 0 ? 25 : 0,
   maxScore: 25,
   attribution: context.progressFiles.length > 0 ? 'clear' : 'harness',
   summary: context.progressFiles.length > 0
    ? `${formatCount('progress log', context.progressFiles.length)} available for evaluation`
    : 'No progress log found under docs/execution/progress',
  },
  {
   id: 'loop-complete',
   dimension: 'workflowCompliance',
   pillar: 'execution',
   label: 'Loop gate satisfied',
   passed: context.handoffAllowed,
   score: context.handoffAllowed ? 25 : 0,
   maxScore: 25,
   attribution: context.handoffAllowed ? 'clear' : 'policy',
   summary: context.handoffAllowed ? 'Quality loop completed successfully' : context.handoffReason,
  },
  {
   id: 'harness-thread-recorded',
   dimension: 'workflowCompliance',
   pillar: 'execution',
   label: 'Harness thread captured',
   passed: context.harnessThreadCount > 0,
   score: context.harnessThreadCount > 0 ? 25 : 0,
   maxScore: 25,
   attribution: context.harnessThreadCount > 0 ? 'clear' : 'harness',
   summary: context.harnessThreadCount > 0
    ? `${formatCount('thread', context.harnessThreadCount)} recorded in harness state`
    : 'Harness state has no recorded threads',
  },
 ];
}

function buildEvidenceChecks(context: CheckContext): ReadonlyArray<EvaluationCheckResult> {
 const coverageScore = context.coveragePercent >= 67 ? 30 : context.coveragePercent >= 34 ? 15 : 0;

 return [
  {
   id: 'evidence-recorded',
   dimension: 'evidenceStrength',
   pillar: 'evidence',
   label: 'Evidence captured',
   passed: context.harnessEvidenceCount > 0,
   score: context.harnessEvidenceCount > 0 ? 40 : 0,
   maxScore: 40,
   attribution: context.harnessEvidenceCount > 0 ? 'clear' : 'harness',
   summary: context.harnessEvidenceCount > 0
    ? `${formatCount('evidence item', context.harnessEvidenceCount)} available for evaluation`
    : 'Harness state has no recorded evidence',
  },
  {
   id: 'observation-coverage',
   dimension: 'evidenceStrength',
   pillar: 'evidence',
   label: 'Observed artifact coverage',
   passed: context.coveragePercent >= 67,
   score: coverageScore,
   maxScore: 30,
   attribution: context.coveragePercent >= 67 ? 'clear' : 'harness',
   summary: context.coveragePercent >= 67
    ? `${context.coveragePercent}% of tracked artifacts were observed directly`
    : `Only ${context.coveragePercent}% of tracked artifacts were observed directly`,
  },
  {
   id: 'loop-history-recorded',
   dimension: 'evidenceStrength',
   pillar: 'evidence',
   label: 'Loop history recorded',
   passed: context.loopHistoryCount > 0,
   score: context.loopHistoryCount > 0 ? 30 : 0,
   maxScore: 30,
   attribution: context.loopHistoryCount > 0 ? 'clear' : 'harness',
   summary: context.loopHistoryCount > 0
    ? `${formatCount('iteration entry', context.loopHistoryCount)} recorded in loop history`
    : 'Loop state has no recorded iteration history',
  },
 ];
}

function buildConfidenceChecks(
 context: CheckContext,
 workflowScore: EvaluationScore,
 evidenceScore: EvaluationScore,
): ReadonlyArray<EvaluationCheckResult> {
 const workflowAlignmentScore = workflowScore.percent >= 75 ? 35 : workflowScore.percent >= 50 ? 20 : 0;
 const evidenceAlignmentScore = evidenceScore.percent >= 70 ? 35 : evidenceScore.percent >= 40 ? 20 : 0;
 const coverageAlignmentScore = context.coveragePercent >= 67 ? 30 : context.coveragePercent >= 34 ? 15 : 0;

 return [
  {
   id: 'workflow-supports-confidence',
   dimension: 'outputConfidence',
   pillar: 'execution',
   label: 'Workflow supports confidence',
   passed: workflowScore.percent >= 75,
   score: workflowAlignmentScore,
   maxScore: 35,
   attribution: workflowScore.percent >= 75 ? 'clear' : 'policy',
   summary: workflowScore.percent >= 75
    ? `Workflow compliance is strong at ${workflowScore.percent}%`
    : `Workflow compliance is only ${workflowScore.percent}%, so reported confidence stays conservative`,
  },
  {
   id: 'evidence-supports-confidence',
   dimension: 'outputConfidence',
   pillar: 'evidence',
   label: 'Evidence supports confidence',
   passed: evidenceScore.percent >= 70,
   score: evidenceAlignmentScore,
   maxScore: 35,
   attribution: evidenceScore.percent >= 70 ? 'clear' : 'harness',
   summary: evidenceScore.percent >= 70
    ? `Evidence strength is strong at ${evidenceScore.percent}%`
    : `Evidence strength is only ${evidenceScore.percent}%, so confidence remains capped`,
  },
  {
   id: 'coverage-supports-confidence',
   dimension: 'outputConfidence',
   pillar: 'evidence',
   label: 'Observed coverage supports confidence',
   passed: context.coveragePercent >= 67,
   score: coverageAlignmentScore,
   maxScore: 30,
   attribution: context.coveragePercent >= 67 ? 'clear' : 'harness',
   summary: context.coveragePercent >= 67
    ? `${context.coveragePercent}% observed coverage supports the reported state`
    : `${context.coveragePercent}% observed coverage is too low for high confidence`,
  },
 ];
}

function determineDominantAttribution(
 checks: ReadonlyArray<EvaluationCheckResult>,
): EvaluationAttribution {
 const failed = checks.filter((check) => !check.passed);
 if (failed.length === 0) {
  return 'clear';
 }

 const totals = new Map<EvaluationAttribution, number>();
 for (const check of failed) {
  totals.set(check.attribution, (totals.get(check.attribution) ?? 0) + check.maxScore);
 }

 return [...totals.entries()]
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? 'unknown';
}

export function evaluateHarnessQualityFromInput(
 input: HarnessEvaluationInput,
): EvaluationReport {
 const harnessState = readHarnessState(input.root);
 const loopState = readLoopState(input.root);
 const loopHistoryCount = loopState?.history.length ?? 0;
 const { observations, progressFiles } = buildObservations(
  input,
  harnessState.threads.length,
  harnessState.evidence.length,
  loopHistoryCount,
 );
 const policy = readHarnessPolicy(input.root);
 const handoff = checkHandoffGate(input.root);
 const observed = observations.filter((observation) => observation.mode === 'observed' && observation.present).length;
 const coverage = {
  observed,
  total: observations.length,
  percent: observations.length === 0 ? 0 : Math.round((observed / observations.length) * 100),
 };
 const context: CheckContext = {
  root: input.root,
  observations,
  planFiles: input.planFiles,
  progressFiles,
  handoffAllowed: handoff.allowed,
  handoffReason: handoff.reason,
  harnessThreadCount: harnessState.threads.length,
  harnessEvidenceCount: harnessState.evidence.length,
  coveragePercent: coverage.percent,
  loopHistoryCount,
 };

 const workflowChecks = buildWorkflowChecks(context)
  .filter((check) => !policy.disabledChecks.has(check.id));
 const evidenceChecks = buildEvidenceChecks(context)
  .filter((check) => !policy.disabledChecks.has(check.id));
 const workflowCompliance = buildScore(workflowChecks);
 const evidenceStrength = buildScore(evidenceChecks);
 const confidenceChecks = buildConfidenceChecks(context, workflowCompliance, evidenceStrength)
  .filter((check) => !policy.disabledChecks.has(check.id));
 const outputConfidence = buildScore(confidenceChecks);
 const checks = [...workflowChecks, ...evidenceChecks, ...confidenceChecks];

 return {
  scores: {
   workflowCompliance,
   evidenceStrength,
   outputConfidence,
  },
  dominantAttribution: determineDominantAttribution(checks),
  coverage,
  observations,
  checks,
 };
}