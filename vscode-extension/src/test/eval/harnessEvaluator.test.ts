import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { evaluateHarnessQuality } from '../../eval/harnessEvaluator';

function createWorkspaceRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-eval-'));
  fs.mkdirSync(path.join(root, '.agentx', 'state'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'execution', 'plans'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'execution', 'progress'), { recursive: true });
  return root;
}

function createAgentxStub(root: string) {
  return {
    workspaceRoot: root,
    listExecutionPlanFiles: () => {
      const plansDir = path.join(root, 'docs', 'execution', 'plans');
      if (!fs.existsSync(plansDir)) {
        return [];
      }

      return fs.readdirSync(plansDir)
        .filter((name) => name.endsWith('.md'))
        .map((name) => `docs/execution/plans/${name}`)
        .sort();
    },
    getStatePath: (fileName: string) => path.join(root, '.agentx', 'state', fileName),
  } as any;
}

describe('harness evaluator', () => {
  it('should score fully observed, complete quality artifacts', () => {
    const root = createWorkspaceRoot();
    fs.writeFileSync(path.join(root, 'docs', 'execution', 'plans', 'EXEC-PLAN-1.md'), '# Plan', 'utf-8');
    fs.writeFileSync(path.join(root, 'docs', 'execution', 'progress', 'EXEC-PLAN-1.md'), '# Progress', 'utf-8');
    fs.writeFileSync(path.join(root, '.agentx', 'state', 'loop-state.json'), JSON.stringify({
      active: false,
      status: 'complete',
      prompt: 'Ship evaluation',
      iteration: 2,
      maxIterations: 10,
      completionCriteria: 'TASK_COMPLETE',
      startedAt: '2026-03-09T10:00:00Z',
      lastIterationAt: '2026-03-09T10:05:00Z',
      history: [],
    }), 'utf-8');
    fs.writeFileSync(path.join(root, '.agentx', 'state', 'harness-state.json'), JSON.stringify({
      version: 1,
      threads: [{
        id: 'thread-1',
        title: 'Implement evaluator',
        taskType: 'story',
        status: 'complete',
        startedAt: '2026-03-09T10:00:00Z',
        updatedAt: '2026-03-09T10:05:00Z',
      }],
      turns: [],
      items: [],
      evidence: [{
        id: 'evidence-1',
        threadId: 'thread-1',
        evidenceType: 'completion',
        summary: 'Completed evaluator',
        createdAt: '2026-03-09T10:05:00Z',
      }],
    }), 'utf-8');

    const report = evaluateHarnessQuality(createAgentxStub(root));

    assert.ok(report);
    assert.equal(report?.score.percent, 100);
    assert.equal(report?.coverage.percent, 100);
    assert.equal(report?.dominantAttribution, 'clear');
    assert.equal(report?.checks.filter((check) => check.passed).length, 5);
  });

  it('should attribute missing artifacts to harness gaps', () => {
    const root = createWorkspaceRoot();

    const report = evaluateHarnessQuality(createAgentxStub(root));

    assert.ok(report);
    assert.equal(report?.score.percent, 0);
    assert.equal(report?.coverage.percent, 0);
    assert.equal(report?.dominantAttribution, 'harness');
    assert.ok(report?.checks.some((check) => check.id === 'loop-complete' && check.attribution === 'policy'));
    assert.ok(report?.checks.some((check) => check.id === 'evidence-recorded' && check.attribution === 'harness'));
  });
});