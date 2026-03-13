import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';
import {
  LearningsIntent,
  getLearningCaptureTarget,
  getDefaultLearningsQuery,
  rankLearnings,
  renderBrainstormGuidanceMarkdown,
  renderCompoundLoopMarkdown,
  renderCaptureGuidanceMarkdown,
  renderRankedLearningsText,
} from '../utils/learnings';

let learningsChannel: vscode.OutputChannel | undefined;

function getLearningsChannel(): vscode.OutputChannel {
  if (!learningsChannel) {
    learningsChannel = vscode.window.createOutputChannel('AgentX Learnings');
  }
  return learningsChannel;
}

async function showRankedLearnings(
  agentx: AgentXContext,
  intent: LearningsIntent,
  query?: string,
): Promise<void> {
  const root = agentx.workspaceRoot;
  if (!root) {
    vscode.window.showWarningMessage('AgentX needs an open workspace to show learnings.');
    return;
  }

  const resolvedQuery = (query ?? getDefaultLearningsQuery(root, intent)).trim();
  const results = rankLearnings(root, intent, resolvedQuery);
  const channel = getLearningsChannel();
  channel.clear();
  channel.appendLine(renderRankedLearningsText(intent, results, resolvedQuery));
  channel.show(true);
}

async function showCaptureGuidance(agentx: AgentXContext): Promise<void> {
  const channel = getLearningsChannel();
  channel.clear();
  channel.appendLine(renderCaptureGuidanceMarkdown(agentx.workspaceRoot));
  channel.show(true);
}

async function showBrainstorm(agentx: AgentXContext, query?: string): Promise<void> {
  const root = agentx.workspaceRoot;
  if (!root) {
    vscode.window.showWarningMessage('AgentX needs an open workspace to brainstorm.');
    return;
  }

  const resolvedQuery = (query ?? getDefaultLearningsQuery(root, 'planning')).trim();
  const results = rankLearnings(root, 'planning', resolvedQuery);
  const channel = getLearningsChannel();
  channel.clear();
  channel.appendLine(renderBrainstormGuidanceMarkdown(root, resolvedQuery, results));
  channel.show(true);
}

async function showCompoundLoop(agentx: AgentXContext): Promise<void> {
  const root = agentx.workspaceRoot;
  if (!root) {
    vscode.window.showWarningMessage('AgentX needs an open workspace to show the compound loop.');
    return;
  }

  const channel = getLearningsChannel();
  channel.clear();
  channel.appendLine(renderCompoundLoopMarkdown(root));
  channel.show(true);
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildLearningTemplate(
  issueNumber: number,
  title: string,
  planPath?: string,
): string {
  const keywords = ['compound capture', 'review', 'reuse'];
  const slug = toSlug(title);
  if (slug) {
    keywords.push(slug.replace(/-/g, ' '));
  }

  const sources = ['docs/guides/KNOWLEDGE-REVIEW-WORKFLOWS.md'];
  if (planPath) {
    sources.push(planPath);
  }

  return [
    '---',
    `id: LEARNING-${issueNumber}`,
    `title: ${title}`,
    'category: workflow-contract',
    'subcategory: compound-capture',
    'phases: review,capture',
    'validation: draft',
    'evidence: medium',
    'mode: shared',
    `keywords: ${keywords.join(',')}`,
    `sources: ${sources.join(',')}`,
    '---',
    '',
    '## Summary',
    '',
    '{Summarize the solved problem and why it should compound future work.}',
    '',
    '## Guidance',
    '',
    '- {What should future agents or operators do?}',
    '- {What evidence made this learning trustworthy?}',
    '',
    '## Use When',
    '',
    '- {When should this learning be surfaced?}',
    '',
    '## Avoid',
    '',
    '- {What anti-pattern, weak inference, or duplicate capture should be avoided?}',
    '',
  ].join('\n');
}

async function createLearningCapture(agentx: AgentXContext): Promise<void> {
  const root = agentx.workspaceRoot;
  if (!root) {
    vscode.window.showWarningMessage('AgentX needs an open workspace to create a learning capture.');
    return;
  }

  const target = getLearningCaptureTarget(root);
  const defaultIssue = target?.issueNumber ? String(target.issueNumber) : '';
  const issueInput = defaultIssue || await vscode.window.showInputBox({
    title: 'AgentX - Learning Capture',
    prompt: 'Issue number for the learning capture',
    placeHolder: '163',
    validateInput: (value) => /^\d+$/.test(value.trim()) ? undefined : 'Enter a numeric issue number.',
  });
  if (!issueInput) {
    return;
  }

  const issueNumber = Number(issueInput.trim());
  const defaultTitle = target?.title ?? `Capture solved problem from issue #${issueNumber}`;
  const title = await vscode.window.showInputBox({
    title: 'AgentX - Learning Capture',
    prompt: 'Learning title',
    value: defaultTitle,
    validateInput: (value) => value.trim().length > 0 ? undefined : 'Title is required.',
  });
  if (!title) {
    return;
  }

  const relativePath = `docs/learnings/LEARNING-${issueNumber}.md`;
  const filePath = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  let created = false;
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, buildLearningTemplate(issueNumber, title.trim(), target?.planPath), 'utf-8');
    created = true;
  }

  const document = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(document, { preview: false });
  vscode.window.showInformationMessage(
    created
      ? `AgentX: created ${relativePath}.`
      : `AgentX: opened existing ${relativePath}.`,
  );
}

export function registerLearningsCommands(
  context: vscode.ExtensionContext,
  agentx: AgentXContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentx.showBrainstormGuide', async (query?: string) => {
      await showBrainstorm(agentx, query);
    }),
    vscode.commands.registerCommand('agentx.showPlanningLearnings', async (query?: string) => {
      await showRankedLearnings(agentx, 'planning', query);
    }),
    vscode.commands.registerCommand('agentx.showReviewLearnings', async (query?: string) => {
      await showRankedLearnings(agentx, 'review', query);
    }),
    vscode.commands.registerCommand('agentx.showKnowledgeCaptureGuidance', async () => {
      await showCaptureGuidance(agentx);
    }),
    vscode.commands.registerCommand('agentx.showCompoundLoop', async () => {
      await showCompoundLoop(agentx);
    }),
    vscode.commands.registerCommand('agentx.createLearningCapture', async () => {
      await createLearningCapture(agentx);
    }),
  );
}
