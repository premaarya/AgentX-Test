import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { ReadyQueueTreeProvider } from '../views/readyQueueTreeProvider';
/**
 * Register the AgentX: Show Ready Queue command.
 * Runs `.agentx/agentx.ps1 ready` and displays unblocked work.
 */
export declare function registerReadyQueueCommand(context: vscode.ExtensionContext, agentx: AgentXContext, readyQueueProvider: ReadyQueueTreeProvider): void;
//# sourceMappingURL=readyQueue.d.ts.map