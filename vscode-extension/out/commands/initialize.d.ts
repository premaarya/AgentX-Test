import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
/**
 * Register the AgentX: Initialize Project command.
 * Opens a WebView wizard for guided setup, or falls back to the legacy
 * quick-pick flow when launched with `{ legacy: true }` argument.
 */
export declare function registerInitializeCommand(context: vscode.ExtensionContext, agentx: AgentXContext): void;
//# sourceMappingURL=initialize.d.ts.map