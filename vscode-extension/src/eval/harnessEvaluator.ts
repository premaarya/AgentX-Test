import { AgentXContext } from '../agentxContext';
import {
  EvaluationReport,
} from './types';
import { evaluateHarnessQualityFromInput } from './harnessEvaluatorInternals';

export function evaluateHarnessQuality(agentx: AgentXContext): EvaluationReport | undefined {
  const root = agentx.workspaceRoot;
  if (!root) {
    return undefined;
  }

  return evaluateHarnessQualityFromInput({
    root,
    planFiles: agentx.listExecutionPlanFiles(),
    loopStatePath: agentx.getStatePath('loop-state.json'),
    harnessStatePath: agentx.getStatePath('harness-state.json'),
  });
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