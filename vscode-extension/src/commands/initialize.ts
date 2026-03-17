import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { runInitializeLocalRuntimeCommand } from './initializeCommandInternals';

/**
 * Register the AgentX: Initialize Local Runtime command.
 * Installs the repo-local AgentX runtime, hooks, templates, and state files.
 * Remote providers are configured separately through adapter commands.
 */
export function registerInitializeLocalRuntimeCommand(
 context: vscode.ExtensionContext,
 agentx: AgentXContext
) {
 const cmd = vscode.commands.registerCommand('agentx.initializeLocalRuntime', async () => {
    await runInitializeLocalRuntimeCommand(context, agentx);
 });

 context.subscriptions.push(cmd);
}
