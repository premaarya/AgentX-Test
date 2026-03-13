import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { registerInitializeCommand } from './initialize';
import { registerStatusCommand } from './status';
import { registerWorkflowCommand } from './workflow';
import { registerDepsCommand } from './deps';
import { registerDigestCommand } from './digest';
import { registerLoopCommand } from './loopCommand';
import { registerAgentNativeReviewCommand } from './agent-native-review';
import { registerLearningsCommands } from './learnings';
import { registerReviewFindingCommands } from './review-findings';
import { registerShowIssueCommand } from './showIssue';
import { registerPendingClarificationCommand } from './pendingClarification';

export function registerAgentXCommands(
 context: vscode.ExtensionContext,
 agentx: AgentXContext,
): void {
 registerInitializeCommand(context, agentx);
 registerStatusCommand(context, agentx);
 registerWorkflowCommand(context, agentx);
 registerDepsCommand(context, agentx);
 registerDigestCommand(context, agentx);
 registerLoopCommand(context, agentx);
 registerAgentNativeReviewCommand(context, agentx);
 registerLearningsCommands(context, agentx);
 registerReviewFindingCommands(context, agentx);
 registerShowIssueCommand(context, agentx);
 registerPendingClarificationCommand(context, agentx);
}