import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
 createLearningCapture,
 showBrainstorm,
 showCaptureGuidance,
 showCompoundLoop,
 showRankedLearnings,
} from './learningsCommandInternals';

export function registerLearningsCommands(
  context: vscode.ExtensionContext,
  agentx: AgentXContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentx.showBrainstormGuide', async (query?: string) => {
      await showBrainstorm(agentx, query);
    }),
    vscode.commands.registerCommand('agentx.showPlanningLearnings', async (query?: string) => {
      await showRankedLearnings(agentx, 'planning', query);
    }),
    vscode.commands.registerCommand('agentx.showReviewLearnings', async (query?: string) => {
      await showRankedLearnings(agentx, 'review', query);
    }),
    vscode.commands.registerCommand('agentx.showKnowledgeCaptureGuidance', async () => {
      await showCaptureGuidance(agentx);
    }),
    vscode.commands.registerCommand('agentx.showCompoundLoop', async () => {
      await showCompoundLoop(agentx);
    }),
    vscode.commands.registerCommand('agentx.createLearningCapture', async () => {
      await createLearningCapture(agentx);
    }),
  );
}
