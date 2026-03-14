import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
 createLearningCapture,
 launchPlanDeepening,
 launchReviewKickoff,
 showBrainstorm,
 showCaptureGuidance,
 showCompoundLoop,
 showOperatorEnablementChecklist,
 showRankedLearnings,
 showWorkflowNextStep,
 showWorkflowRolloutScorecard,
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
    vscode.commands.registerCommand('agentx.showWorkflowNextStep', async () => {
      await showWorkflowNextStep(agentx);
    }),
    vscode.commands.registerCommand('agentx.deepenPlan', async () => {
      await launchPlanDeepening(agentx);
    }),
    vscode.commands.registerCommand('agentx.kickoffReview', async () => {
      await launchReviewKickoff(agentx);
    }),
    vscode.commands.registerCommand('agentx.showWorkflowRolloutScorecard', async () => {
      await showWorkflowRolloutScorecard(agentx);
    }),
    vscode.commands.registerCommand('agentx.showOperatorEnablementChecklist', async () => {
      await showOperatorEnablementChecklist(agentx);
    }),
    vscode.commands.registerCommand('agentx.createLearningCapture', async () => {
      await createLearningCapture(agentx);
    }),
  );
}
