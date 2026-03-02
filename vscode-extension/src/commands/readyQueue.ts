import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { ReadyQueueTreeProvider } from '../views/readyQueueTreeProvider';
import { stripAnsi } from '../utils/stripAnsi';

/**
 * Register the AgentX: Show Ready Queue command.
 * Runs `.agentx/agentx.ps1 ready --json` and populates the sidebar tree view
 * (consistent with the Agents, Workflows, and Templates views).
 */
export function registerReadyQueueCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext,
 readyQueueProvider: ReadyQueueTreeProvider
) {
 const cmd = vscode.commands.registerCommand('agentx.readyQueue', async () => {
 if (!await agentx.checkInitialized()) {
 // Tree provider shows "AgentX not initialized" inline -- just focus the view
 readyQueueProvider.refresh();
 await vscode.commands.executeCommand('agentx-ready.focus');
 return;
 }

 try {
 // Fetch JSON output for structured tree view
 const jsonOutput = await agentx.runCli('ready', ['--json']);
 const cleaned = stripAnsi(jsonOutput).trim();

 let issues: any[] | undefined;
 try {
  issues = JSON.parse(cleaned);
  if (!Array.isArray(issues)) { issues = undefined; }
 } catch { issues = undefined; }

 // Empty state is handled inline by the tree provider ("No unblocked work")

 // Feed structured data directly to tree and reveal the sidebar view
 readyQueueProvider.refresh(issues);

 // Reveal the Ready Queue tree view in the sidebar
 await vscode.commands.executeCommand('agentx-ready.focus');
 } catch (err: unknown) {
 const message = err instanceof Error ? err.message : String(err);
 vscode.window.showErrorMessage(`AgentX ready queue failed: ${message}`);
 readyQueueProvider.refresh();
 }
 });

 context.subscriptions.push(cmd);
}
