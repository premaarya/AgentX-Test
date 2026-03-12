import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
  ReviewFindingRecord,
  getPromotableReviewFindings,
  loadReviewFindingRecords,
  promoteReviewFinding,
  renderReviewFindingsText,
} from '../review/review-findings';

let findingsChannel: vscode.OutputChannel | undefined;

function getFindingsChannel(): vscode.OutputChannel {
  if (!findingsChannel) {
    findingsChannel = vscode.window.createOutputChannel('AgentX Review Findings');
  }
  return findingsChannel;
}

function showFindings(records: ReadonlyArray<ReviewFindingRecord>): void {
  const channel = getFindingsChannel();
  channel.clear();
  channel.appendLine(renderReviewFindingsText(records));
  channel.show(true);
}

async function selectFinding(root: string): Promise<ReviewFindingRecord | undefined> {
  const records = getPromotableReviewFindings(root);
  if (records.length === 0) {
    return undefined;
  }

  const selected = await vscode.window.showQuickPick(
    records.map((record) => ({
      label: `${record.id} ${record.title}`,
      description: `${record.priority} | ${record.severity} | ${record.promotion}`,
      detail: record.summary || record.relativePath,
      findingId: record.id,
    })),
    {
      title: 'AgentX - Promote Review Finding',
      placeHolder: 'Select a durable review finding to promote into backlog work',
    },
  );

  if (!selected) {
    return undefined;
  }

  return records.find((record) => record.id === selected.findingId);
}

export function registerReviewFindingCommands(
  context: vscode.ExtensionContext,
  agentx: AgentXContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentx.showReviewFindings', async () => {
      const root = agentx.workspaceRoot;
      if (!root) {
        vscode.window.showWarningMessage('AgentX needs an open workspace to show review findings.');
        return;
      }

      showFindings(loadReviewFindingRecords(root));
    }),
    vscode.commands.registerCommand('agentx.promoteReviewFinding', async (findingId?: string) => {
      const root = agentx.workspaceRoot;
      if (!root) {
        vscode.window.showWarningMessage('AgentX needs an open workspace to promote review findings.');
        return;
      }

      const finding = findingId
        ? loadReviewFindingRecords(root).find((record) => record.id.toLowerCase() === findingId.toLowerCase())
        : await selectFinding(root);
      if (!finding) {
        vscode.window.showWarningMessage('No promotable review finding was selected.');
        return;
      }

      try {
        const result = await promoteReviewFinding(agentx, finding.id);
        showFindings(loadReviewFindingRecords(root));
        const detail = result.alreadyPromoted
          ? `already linked to issue #${result.issueNumber}`
          : `promoted as issue #${result.issueNumber}`;
        vscode.window.showInformationMessage(`AgentX: ${result.finding.id} ${detail}.`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`AgentX failed to promote the finding: ${message}`);
      }
    }),
  );
}