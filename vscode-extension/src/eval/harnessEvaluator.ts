import * as fs from 'fs';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';
import { readHarnessState } from '../utils/harnessState';
import { checkHandoffGate, readLoopState } from '../utils/loopStateChecker';
import {
  ArtifactObservation,
  EvaluationAttribution,
  EvaluationCheckResult,
  EvaluationReport,
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
}

interface DeterministicCheck {
  readonly id: string;
  readonly pillar: EvaluationCheckResult['pillar'];
  readonly label: string;
  readonly maxScore: number;
  run(context: CheckContext): EvaluationCheckResult;
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

function buildObservations(agentx: AgentXContext, root: string): {
  readonly observations: ReadonlyArray<ArtifactObservation>;
  readonly planFiles: ReadonlyArray<string>;
  readonly progressFiles: ReadonlyArray<string>;
} {
  const planFiles = agentx.listExecutionPlanFiles();
  const progressDir = path.join(root, 'docs', 'progress');
  const progressFiles = countMarkdownFiles(progressDir).map((name) => `docs/progress/${name}`);
  const loopStatePath = agentx.getStatePath('loop-state.json');
  const harnessStatePath = agentx.getStatePath('harness-state.json');

  const observations: ArtifactObservation[] = [
    {
      id: 'execution-plan',
      label: 'Execution plan',
      mode: planFiles.length > 0 ? 'observed' : 'inferred',
      present: planFiles.length > 0,
      detail: planFiles.length > 0 ? `${formatCount('plan file', planFiles.length)} discovered` : 'No execution plans discovered',
    },
    {
      id: 'progress-log',
      label: 'Progress log',
      mode: progressFiles.length > 0 ? 'observed' : 'inferred',
      present: progressFiles.length > 0,
      detail: progressFiles.length > 0 ? `${formatCount('progress log', progressFiles.length)} discovered` : 'No progress logs discovered',
    },
    {
      id: 'loop-state',
      label: 'Loop state',
      mode: fileExists(loopStatePath) ? 'observed' : 'inferred',
      present: fileExists(loopStatePath),
      detail: fileExists(loopStatePath) ? 'Loop state file observed' : 'Loop state file missing',
    },
    {
      id: 'harness-state',
      label: 'Harness state',
      mode: fileExists(harnessStatePath) ? 'observed' : 'inferred',
      present: fileExists(harnessStatePath),
      detail: fileExists(harnessStatePath) ? 'Harness state file observed' : 'Harness state file missing',
    },
  ];

  return { observations, planFiles, progressFiles };
}

const CHECKS: ReadonlyArray<DeterministicCheck> = [
  {
    id: 'execution-plan-present',
    pillar: 'planning',
    label: 'Execution plan linked',
    maxScore: 20,
    run: (context) => ({
      id: 'execution-plan-present',
      pillar: 'planning',
      label: 'Execution plan linked',
      passed: context.planFiles.length > 0,
      score: context.planFiles.length > 0 ? 20 : 0,
      maxScore: 20,
      attribution: context.planFiles.length > 0 ? 'clear' : 'harness',
      summary: context.planFiles.length > 0
        ? `${formatCount('plan file', context.planFiles.length)} available for evaluation`
        : 'No execution plan found for the current workspace',
    }),
  },
  {
    id: 'progress-log-present',
    pillar: 'planning',
    label: 'Progress log tracked',
    maxScore: 20,
    run: (context) => ({
      id: 'progress-log-present',
      pillar: 'planning',
      label: 'Progress log tracked',
      passed: context.progressFiles.length > 0,
      score: context.progressFiles.length > 0 ? 20 : 0,
      maxScore: 20,
      attribution: context.progressFiles.length > 0 ? 'clear' : 'harness',
      summary: context.progressFiles.length > 0
        ? `${formatCount('progress log', context.progressFiles.length)} available for evaluation`
        : 'No progress log found under docs/progress',
    }),
  },
  {
    id: 'loop-complete',
    pillar: 'execution',
    label: 'Loop gate satisfied',
    maxScore: 20,
    run: (context) => ({
      id: 'loop-complete',
      pillar: 'execution',
      label: 'Loop gate satisfied',
      passed: context.handoffAllowed,
      score: context.handoffAllowed ? 20 : 0,
      maxScore: 20,
      attribution: context.handoffAllowed ? 'clear' : 'policy',
      summary: context.handoffAllowed ? 'Quality loop completed successfully' : context.handoffReason,
    }),
  },
  {
    id: 'harness-thread-recorded',
    pillar: 'execution',
    label: 'Harness thread captured',
    maxScore: 20,
    run: (context) => ({
      id: 'harness-thread-recorded',
      pillar: 'execution',
      label: 'Harness thread captured',
      passed: context.harnessThreadCount > 0,
      score: context.harnessThreadCount > 0 ? 20 : 0,
      maxScore: 20,
      attribution: context.harnessThreadCount > 0 ? 'clear' : 'harness',
      summary: context.harnessThreadCount > 0
        ? `${formatCount('thread', context.harnessThreadCount)} recorded in harness state`
        : 'Harness state has no recorded threads',
    }),
  },
  {
    id: 'evidence-recorded',
    pillar: 'evidence',
    label: 'Evidence captured',
    maxScore: 20,
    run: (context) => ({
      id: 'evidence-recorded',
      pillar: 'evidence',
      label: 'Evidence captured',
      passed: context.harnessEvidenceCount > 0,
      score: context.harnessEvidenceCount > 0 ? 20 : 0,
      maxScore: 20,
      attribution: context.harnessEvidenceCount > 0 ? 'clear' : 'harness',
      summary: context.harnessEvidenceCount > 0
        ? `${formatCount('evidence item', context.harnessEvidenceCount)} available for evaluation`
        : 'Harness state has no recorded evidence',
    }),
  },
];

function determineDominantAttribution(checks: ReadonlyArray<EvaluationCheckResult>): EvaluationAttribution {
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

export function evaluateHarnessQuality(agentx: AgentXContext): EvaluationReport | undefined {
  const root = agentx.workspaceRoot;
  if (!root) {
    return undefined;
  }

  const { observations, planFiles, progressFiles } = buildObservations(agentx, root);
  const harnessState = readHarnessState(root);
  const loopState = readLoopState(root);
  const handoff = checkHandoffGate(root);
  const context: CheckContext = {
    root,
    observations,
    planFiles,
    progressFiles,
    handoffAllowed: handoff.allowed,
    handoffReason: handoff.reason,
    harnessThreadCount: harnessState.threads.length,
    harnessEvidenceCount: harnessState.evidence.length,
  };

  const checks = CHECKS.map((check) => check.run(context));
  const earned = checks.reduce((sum, check) => sum + check.score, 0);
  const max = checks.reduce((sum, check) => sum + check.maxScore, 0);
  const observed = observations.filter((observation) => observation.mode === 'observed' && observation.present).length;

  return {
    score: {
      earned,
      max,
      percent: max === 0 ? 0 : Math.round((earned / max) * 100),
      passedChecks: checks.filter((check) => check.passed).length,
      totalChecks: checks.length,
    },
    dominantAttribution: determineDominantAttribution(checks),
    coverage: {
      observed,
      total: observations.length,
      percent: observations.length === 0 ? 0 : Math.round((observed / observations.length) * 100),
    },
    observations,
    checks,
  };
}

export function getEvaluationSummary(agentx: AgentXContext): string {
  const report = evaluateHarnessQuality(agentx);
  if (!report) {
    return 'No evaluation';
  }

  return `${report.score.percent}% (${report.score.passedChecks}/${report.score.totalChecks} checks)`;
}

export function getEvaluationTooltip(agentx: AgentXContext): string {
  const report = evaluateHarnessQuality(agentx);
  if (!report) {
    return 'No workspace open for evaluation.';
  }

  const failingChecks = report.checks.filter((check) => !check.passed);
  if (failingChecks.length === 0) {
    return 'All deterministic harness checks passed.';
  }

  return failingChecks.map((check) => `${check.label}: ${check.summary}`).join('\n');
}

export function getCoverageSummary(agentx: AgentXContext): string {
  const report = evaluateHarnessQuality(agentx);
  if (!report) {
    return '0% observed';
  }
  return `${report.coverage.percent}% observed`;
}

export function getCoverageTooltip(agentx: AgentXContext): string {
  const report = evaluateHarnessQuality(agentx);
  if (!report) {
    return 'No workspace open for coverage analysis.';
  }

  return report.observations.map((observation) => `${observation.label}: ${observation.detail}`).join('\n');
}

export function getAttributionSummary(agentx: AgentXContext): string {
  const report = evaluateHarnessQuality(agentx);
  if (!report) {
    return 'unknown';
  }
  return report.dominantAttribution;
}

export function getAttributionTooltip(agentx: AgentXContext): string {
  const report = evaluateHarnessQuality(agentx);
  if (!report) {
    return 'No workspace open for attribution analysis.';
  }

  if (report.dominantAttribution === 'clear') {
    return 'No dominant failure attribution. All deterministic checks passed.';
  }

  const checks = report.checks
    .filter((check) => !check.passed && check.attribution === report.dominantAttribution)
    .map((check) => `${check.label}: ${check.summary}`);

  return checks.length > 0
    ? checks.join('\n')
    : 'No dominant attribution details available.';
}