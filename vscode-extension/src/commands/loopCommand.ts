import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
  completeHarnessThread,
  getHarnessStatusDisplay,
  recordHarnessIteration,
  recordHarnessStatusCheck,
  startHarnessThread,
} from '../utils/harnessState';

/**
 * Register the AgentX: Iterative Loop commands.
 * Manages Ralph Loop style iterative refinement cycles.
 */
export function registerLoopCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext
) {
 const ensureInitialized = async (): Promise<boolean> => {
  if (!await agentx.checkInitialized()) {
   vscode.window.showWarningMessage('AgentX is not initialized.');
   return false;
  }
  return true;
 };

 // Main loop management command
 const loopCmd = vscode.commands.registerCommand('agentx.loop', async () => {
  if (!await ensureInitialized()) {
   return;
  }

  const action = await vscode.window.showQuickPick(
   [
    { label: 'start', description: 'Start a new iterative refinement loop' },
    { label: 'status', description: 'Check active loop state' },
    { label: 'iterate', description: 'Advance to next iteration with summary' },
    { label: 'complete', description: 'Mark loop as successfully done' },
    { label: 'cancel', description: 'Cancel the active loop' },
   ],
   { placeHolder: 'Select loop action', title: 'AgentX Iterative Loop' }
  );
  if (!action) { return; }

  switch (action.label) {
   case 'start':
    await loopStart(agentx);
    break;
   case 'status':
    await loopStatus(agentx);
    break;
   case 'iterate':
    await loopIterate(agentx);
    break;
   case 'complete':
    await loopComplete(agentx);
    break;
   case 'cancel':
    await loopCancel(agentx);
    break;
  }
 });

 const loopStartCmd = vscode.commands.registerCommand('agentx.loopStart', async () => {
  if (!await ensureInitialized()) {
   return;
  }
  await loopStart(agentx);
 });

 const loopStatusCmd = vscode.commands.registerCommand('agentx.loopStatus', async () => {
  if (!await ensureInitialized()) {
   return;
  }
  await loopStatus(agentx);
 });

 const loopIterateCmd = vscode.commands.registerCommand('agentx.loopIterate', async () => {
  if (!await ensureInitialized()) {
   return;
  }
  await loopIterate(agentx);
 });

 const loopCompleteCmd = vscode.commands.registerCommand('agentx.loopComplete', async () => {
  if (!await ensureInitialized()) {
   return;
  }
  await loopComplete(agentx);
 });

 const loopCancelCmd = vscode.commands.registerCommand('agentx.loopCancel', async () => {
  if (!await ensureInitialized()) {
   return;
  }
  await loopCancel(agentx);
 });

 context.subscriptions.push(
  loopCmd,
  loopStartCmd,
  loopStatusCmd,
  loopIterateCmd,
  loopCompleteCmd,
  loopCancelCmd,
 );
}

async function loopStart(agentx: AgentXContext): Promise<void> {
 const prompt = await vscode.window.showInputBox({
  prompt: 'Task description for the iterative loop',
  placeHolder: 'e.g., Fix all failing tests in src/ following TDD',
  ignoreFocusOut: true,
 });
 if (!prompt) { return; }

 const maxIterStr = await vscode.window.showInputBox({
  prompt: 'Maximum iterations (safety limit)',
  value: '20',
  validateInput: (v) => {
   const n = parseInt(v, 10);
   return (isNaN(n) || n < 1) ? 'Enter a positive integer' : null;
  },
 });
 if (!maxIterStr) { return; }

 const criteria = await vscode.window.showInputBox({
  prompt: 'Completion criteria (what signals done)',
  placeHolder: 'e.g., ALL_TESTS_PASSING',
  value: 'TASK_COMPLETE',
 });
 if (!criteria) { return; }

 const issueStr = await vscode.window.showInputBox({
  prompt: 'Associated issue number (optional, press Enter to skip)',
  placeHolder: 'e.g., 42',
 });

 try {
  const args: string[] = ['start', '-p', `"${prompt}"`, '-m', maxIterStr, '-c', `"${criteria}"`];
  if (issueStr && parseInt(issueStr, 10) > 0) {
   args.push('-i', issueStr);
  }

  const output = await agentx.runCli('loop', args);
    syncHarnessStart(agentx, prompt, criteria, issueStr);
    showLoopOutput('Loop Started', output, getHarnessDisplay(agentx));
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  vscode.window.showErrorMessage(`Loop start failed: ${message}`);
 }
}

async function loopStatus(agentx: AgentXContext): Promise<void> {
 try {
  const output = await agentx.runCli('loop', ['status']);
  syncHarnessStatus(agentx);
  showLoopOutput('Loop Status', output, getHarnessDisplay(agentx));
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  vscode.window.showErrorMessage(`Loop status failed: ${message}`);
 }
}

async function loopIterate(agentx: AgentXContext): Promise<void> {
 const summary = await vscode.window.showInputBox({
  prompt: 'Iteration summary (what was done/changed)',
  placeHolder: 'e.g., Fixed 3 tests, 2 remaining',
  ignoreFocusOut: true,
 });
 if (!summary) { return; }

 try {
  const output = await agentx.runCli('loop', [
   'iterate', '-s', `"${summary}"`,
  ]);
  syncHarnessIteration(agentx, summary);
  showLoopOutput('Loop Iteration', output, getHarnessDisplay(agentx));
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  vscode.window.showErrorMessage(`Loop iterate failed: ${message}`);
 }
}

async function loopComplete(agentx: AgentXContext): Promise<void> {
 const summary = await vscode.window.showInputBox({
  prompt: 'Completion summary',
  placeHolder: 'e.g., All tests passing, coverage at 85%',
 });

 try {
  const args = ['complete'];
  if (summary) {
   args.push('-s', `"${summary}"`);
  }
  const output = await agentx.runCli('loop', args);
  syncHarnessComplete(agentx, summary ?? 'Loop completed successfully.');
  showLoopOutput('Loop Complete', output, getHarnessDisplay(agentx));
  vscode.window.showInformationMessage('Iterative loop completed successfully.');
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  vscode.window.showErrorMessage(`Loop complete failed: ${message}`);
 }
}

async function loopCancel(agentx: AgentXContext): Promise<void> {
 try {
  const output = await agentx.runCli('loop', ['cancel']);
  syncHarnessCancel(agentx);
  showLoopOutput('Loop Cancelled', output, getHarnessDisplay(agentx));
  vscode.window.showInformationMessage('Iterative loop cancelled.');
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  vscode.window.showErrorMessage(`Loop cancel failed: ${message}`);
 }
}

function getHarnessDisplay(agentx: AgentXContext): string | undefined {
 const root = agentx.workspaceRoot;
 if (!root) {
  return undefined;
 }
 return getHarnessStatusDisplay(root);
}

function syncHarnessStart(
 agentx: AgentXContext,
 prompt: string,
 completionCriteria: string,
 issueStr?: string,
): void {
 const root = agentx.workspaceRoot;
 if (!root) {
  return;
 }

 try {
  const issueNumber = issueStr ? parseInt(issueStr, 10) : undefined;
  startHarnessThread(root, {
   taskType: 'iterative-loop',
   title: 'Iterative Loop',
   prompt,
   completionCriteria,
   issueNumber: Number.isFinite(issueNumber) ? issueNumber : null,
   planPath: agentx.listExecutionPlanFiles()[0],
  });
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  void vscode.window.showWarningMessage(`Harness state was not updated: ${message}`);
 }
}

function syncHarnessStatus(agentx: AgentXContext): void {
 const root = agentx.workspaceRoot;
 if (!root) {
  return;
 }

 try {
  recordHarnessStatusCheck(root, 'Loop status requested');
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  void vscode.window.showWarningMessage(`Harness state was not updated: ${message}`);
 }
}

function syncHarnessIteration(agentx: AgentXContext, summary: string): void {
 const root = agentx.workspaceRoot;
 if (!root) {
  return;
 }

 try {
  recordHarnessIteration(root, summary);
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  void vscode.window.showWarningMessage(`Harness state was not updated: ${message}`);
 }
}

function syncHarnessComplete(agentx: AgentXContext, summary: string): void {
 const root = agentx.workspaceRoot;
 if (!root) {
  return;
 }

 try {
  completeHarnessThread(root, { status: 'complete', summary });
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  void vscode.window.showWarningMessage(`Harness state was not updated: ${message}`);
 }
}

function syncHarnessCancel(agentx: AgentXContext): void {
 const root = agentx.workspaceRoot;
 if (!root) {
  return;
 }

 try {
  completeHarnessThread(root, { status: 'cancelled', summary: 'Loop cancelled.' });
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  void vscode.window.showWarningMessage(`Harness state was not updated: ${message}`);
 }
}

function showLoopOutput(title: string, output: string, harnessDisplay?: string): void {
 const channel = vscode.window.createOutputChannel('AgentX Loop');
 channel.clear();
 channel.appendLine(`=== AgentX: ${title} ===\n`);
 channel.appendLine(output);
 if (harnessDisplay) {
  channel.appendLine('');
  channel.appendLine(`Harness: ${harnessDisplay}`);
 }
 channel.show();
}
