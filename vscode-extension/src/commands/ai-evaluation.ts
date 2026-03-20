import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
  runAIEvaluation,
  scaffoldAIEvaluationContract,
  showAIEvaluationStatus,
} from './aiEvaluationCommandInternals';

export function registerAIEvaluationCommands(
  context: vscode.ExtensionContext,
  agentx: AgentXContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentx.showAIEvaluationStatus', async () => {
      await showAIEvaluationStatus(agentx);
    }),
    vscode.commands.registerCommand('agentx.scaffoldAIEvaluationContract', async () => {
      await scaffoldAIEvaluationContract(agentx);
    }),
    vscode.commands.registerCommand('agentx.runAIEvaluation', async () => {
      await runAIEvaluation(agentx);
    }),
  );
}