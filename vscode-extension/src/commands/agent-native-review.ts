import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
  evaluateAgentNativeReview,
  renderAgentNativeReviewText,
} from '../review/agent-native-review';

let reviewChannel: vscode.OutputChannel | undefined;

function getReviewChannel(): vscode.OutputChannel {
  if (!reviewChannel) {
    reviewChannel = vscode.window.createOutputChannel('AgentX Review');
  }
  return reviewChannel;
}

export function registerAgentNativeReviewCommand(
  context: vscode.ExtensionContext,
  agentx: AgentXContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentx.showAgentNativeReview', async () => {
      const report = evaluateAgentNativeReview(agentx);
      if (!report) {
        vscode.window.showWarningMessage('AgentX needs an open workspace to review parity surfaces.');
        return;
      }

      const channel = getReviewChannel();
      channel.clear();
      channel.appendLine(renderAgentNativeReviewText(report));
      channel.show(true);
    }),
  );
}
