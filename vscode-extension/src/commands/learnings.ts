import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
  LearningsIntent,
  getDefaultLearningsQuery,
  rankLearnings,
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

export function registerLearningsCommands(
  context: vscode.ExtensionContext,
  agentx: AgentXContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentx.showPlanningLearnings', async (query?: string) => {
      await showRankedLearnings(agentx, 'planning', query);
    }),
    vscode.commands.registerCommand('agentx.showReviewLearnings', async (query?: string) => {
      await showRankedLearnings(agentx, 'review', query);
    }),
    vscode.commands.registerCommand('agentx.showKnowledgeCaptureGuidance', async () => {
      await showCaptureGuidance(agentx);
    }),
  );
}
