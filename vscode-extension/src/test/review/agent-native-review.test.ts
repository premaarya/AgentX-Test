import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  evaluateAgentNativeReview,
  renderAgentNativeReviewMarkdown,
} from '../../review/agent-native-review';

function writeFile(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

describe('agent-native review', () => {
  let tmpDir: string;
  const workflowGuidePath = 'docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-agent-review-'));
    writeFile(tmpDir, workflowGuidePath, '# Knowledge And Review Workflows\n');
    writeFile(tmpDir, 'docs/guides/WORKFLOW-PILOT-ORDER.md', '# Pilot Order\n');
    writeFile(tmpDir, '.github/templates/REVIEW-TEMPLATE.md', '# Review\n');
    writeFile(tmpDir, 'docs/artifacts/learnings/LEARNING-165.md', '# Learning\n');
    writeFile(tmpDir, 'docs/artifacts/reviews/findings/FINDING-165-001.md', '# Finding\n');
    writeFile(tmpDir, 'vscode-extension/package.json', JSON.stringify({
      contributes: {
        commands: [
          { command: 'agentx.showBrainstormGuide' },
          { command: 'agentx.runWorkflow' },
          { command: 'agentx.showReviewLearnings' },
          { command: 'agentx.showCompoundLoop' },
          { command: 'agentx.showKnowledgeCaptureGuidance' },
          { command: 'agentx.showAgentNativeReview' },
          { command: 'agentx.showTaskBundles' },
          { command: 'agentx.showBoundedParallelRuns' },
        ],
      },
    }));
    writeFile(tmpDir, 'vscode-extension/src/chat/chatParticipant.ts', [
      'brainstorm',
      'run engineer',
      'run reviewer',
      'run architect',
      'learnings review',
      'compound',
      'showReviewLearnings',
      'capture guidance',
      'showKnowledgeCaptureGuidance',
      'task bundles',
      'bounded parallel',
    ].join('\n'));
    writeFile(tmpDir, 'vscode-extension/src/chat/requestRouter.ts', 'tryHandleTaskBundleRequest\ntryHandleBoundedParallelRequest\n');
    writeFile(tmpDir, 'vscode-extension/src/chat/requestRouterInternals.ts', [
      'tryHandleBrainstormRequest',
      'tryHandleCompoundRequest',
      'tryHandleTaskBundleRequest',
      'tryHandleBoundedParallelRequest',
    ].join('\n'));
    writeFile(tmpDir, 'vscode-extension/src/views/workTreeProvider.ts', [
      'Brainstorm',
      'agentx.showBrainstormGuide',
      'Show workflow steps',
      'agentx.runWorkflow',
      'Review learnings',
      'agentx.showReviewLearnings',
      'Compound loop',
      'agentx.showCompoundLoop',
      'Capture guidance',
      'agentx.showKnowledgeCaptureGuidance',
    ].join('\n'));
    writeFile(tmpDir, 'vscode-extension/src/views/statusTreeProvider.ts', 'agentx.showAgentNativeReview\n');
    writeFile(tmpDir, 'vscode-extension/src/agentxContext.ts', [
      'workspaceRoot',
      'getPendingClarification',
      'listExecutionPlanFiles',
      'getStatePath',
      'docs/artifacts/learnings',
      'docs/guides/WORKFLOW-PILOT-ORDER.md',
    ].join('\n'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('scores complete action, context, and workspace parity highly', () => {
    const report = evaluateAgentNativeReview({ workspaceRoot: tmpDir } as any);

    assert.ok(report);
    assert.equal(report?.score.percent, 100);
    assert.equal(report?.dominantSeverity, 'none');
    assert.equal(report?.capabilityMap.filter((entry) => entry.severity === 'none').length, 7);
  });

  it('flags missing agent surfaces as high-severity parity gaps', () => {
    writeFile(tmpDir, 'vscode-extension/src/chat/chatParticipant.ts', 'run engineer\n');

    const report = evaluateAgentNativeReview({ workspaceRoot: tmpDir } as any);

    assert.ok(report);
    assert.equal(report?.dominantSeverity, 'high');
    assert.ok(report?.capabilityMap.some((entry) => entry.severity === 'high'));
  });

  it('renders an advisory-first markdown summary', () => {
    const report = evaluateAgentNativeReview({ workspaceRoot: tmpDir } as any);
    const markdown = renderAgentNativeReviewMarkdown(report!);

    assert.ok(markdown.includes('Agent-Native Review'));
    assert.ok(markdown.includes('Capability map:'));
    assert.ok(markdown.includes(`Reference guide: ${workflowGuidePath}`));
  });

  it('accepts hidden runtime review assets when visible defaults are absent', () => {
    fs.rmSync(path.join(tmpDir, 'docs', 'guides'), { recursive: true, force: true });
    fs.rmSync(path.join(tmpDir, '.github', 'templates'), { recursive: true, force: true });
    writeFile(tmpDir, '.agentx/runtime/docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md', '# Runtime Guide\n');
    writeFile(tmpDir, '.agentx/runtime/templates/REVIEW-TEMPLATE.md', '# Runtime Review\n');

    const report = evaluateAgentNativeReview({ workspaceRoot: tmpDir } as any);

    assert.ok(report);
    assert.equal(report?.dominantSeverity, 'none');
  });
});
