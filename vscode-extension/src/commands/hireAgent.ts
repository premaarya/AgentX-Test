import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';

export function registerHireAgentCommand(
  context: vscode.ExtensionContext,
  agentx: AgentXContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentx.hireAgent', async () => {
      const root = agentx.workspaceRoot;
      if (!root) {
        vscode.window.showWarningMessage('Open a workspace to hire an agent.');
        return;
      }

      const hasCliRuntime = agentx.hasCliRuntime();
      if (hasCliRuntime) {
        // Prefer workspace-local CLI; fall back to bundled copy inside the extension.
        const workspaceCli = path.join(root, '.agentx', 'agentx.ps1');
        const bundledCli = path.join(context.extensionUri.fsPath, '.github', 'agentx', 'agentx.ps1');
        const cliPath = fs.existsSync(workspaceCli) ? workspaceCli : bundledCli;

        const terminal = vscode.window.createTerminal('AgentX Hire Agent');
        terminal.show();
        terminal.sendText(`cd "${root}"`);
        terminal.sendText(`pwsh -NoProfile -File "${cliPath}" hire`);
      } else {
        vscode.window.showInformationMessage(
          'Hiring an agent requires the AgentX CLI runtime. Run "AgentX: Initialize Local Runtime" first.',
        );
      }
    }),
  );
}
