import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
  getPendingClarification,
  renderUsageGuidance,
  resetChatRouterInternalStateForTests,
  resumePendingClarification,
  runAgentCommand,
  tryHandleAgentNativeReviewRequest,
  tryHandleBrainstormRequest,
  tryHandleCaptureGuidanceRequest,
  tryHandleClarificationStatusRequest,
  tryHandleCompoundRequest,
  tryHandleContinueRequest,
  tryHandleCreateLearningCaptureRequest,
  tryHandleEnablementChecklistRequest,
  tryHandleLearningsRequest,
  tryHandlePlanDeepeningRequest,
  tryHandlePromoteFindingRequest,
  tryHandleReviewKickoffRequest,
  tryHandleReviewFindingsRequest,
  tryHandleWorkflowNextStepRequest,
  tryHandleWorkflowRolloutRequest,
} from './requestRouterInternals';

export async function getAgentXChatFollowups(
  agentx: AgentXContext,
): Promise<vscode.ChatFollowup[]> {
  const pending = await getPendingClarification(agentx);
  if (!pending) {
    return [];
  }

  return [
    {
      prompt: 'continue',
      label: `Continue ${pending.agentName} clarification`,
    },
    {
      prompt: 'clarification status',
      label: 'Show pending clarification context',
    },
  ];
}

export function resetChatRouterStateForTests(): void {
  resetChatRouterInternalStateForTests();
}

export async function routeAgentXChatRequest(
  userText: string,
  response: vscode.ChatResponseStream,
  agentx: AgentXContext,
): Promise<vscode.ChatResult> {
  const runMatch = userText.match(/^run\s+(\S+)\s+(.+)$/is);
  if (runMatch) {
    return runAgentCommand(response, agentx, runMatch[1].toLowerCase(), runMatch[2].trim());
  }

  const pending = await getPendingClarification(agentx);

  const clarificationStatusResult = await tryHandleClarificationStatusRequest(userText, response, pending);
  if (clarificationStatusResult) {
    return clarificationStatusResult;
  }

  const continueResult = await tryHandleContinueRequest(userText, response, agentx, pending);
  if (continueResult) {
    return continueResult;
  }

  const root = agentx.workspaceRoot;

  const workflowNextStepResult = await tryHandleWorkflowNextStepRequest(userText, response, root, pending);
  if (workflowNextStepResult) {
    return workflowNextStepResult;
  }

  const planDeepeningResult = await tryHandlePlanDeepeningRequest(userText, response, root, pending);
  if (planDeepeningResult) {
    return planDeepeningResult;
  }

  const reviewKickoffResult = await tryHandleReviewKickoffRequest(userText, response, root, pending);
  if (reviewKickoffResult) {
    return reviewKickoffResult;
  }

  const workflowRolloutResult = await tryHandleWorkflowRolloutRequest(userText, response, root, pending);
  if (workflowRolloutResult) {
    return workflowRolloutResult;
  }

  const enablementChecklistResult = await tryHandleEnablementChecklistRequest(userText, response, root, pending);
  if (enablementChecklistResult) {
    return enablementChecklistResult;
  }

  const learningsResult = await tryHandleLearningsRequest(userText, response, root);
  if (learningsResult) {
    return learningsResult;
  }

  const brainstormResult = await tryHandleBrainstormRequest(userText, response, root);
  if (brainstormResult) {
    return brainstormResult;
  }

  const captureGuidanceResult = await tryHandleCaptureGuidanceRequest(userText, response, root);
  if (captureGuidanceResult) {
    return captureGuidanceResult;
  }

  const compoundResult = await tryHandleCompoundRequest(userText, response, root);
  if (compoundResult) {
    return compoundResult;
  }

  const createLearningCaptureResult = await tryHandleCreateLearningCaptureRequest(userText, response, root);
  if (createLearningCaptureResult) {
    return createLearningCaptureResult;
  }

  const agentNativeReviewResult = await tryHandleAgentNativeReviewRequest(userText, response, agentx);
  if (agentNativeReviewResult) {
    return agentNativeReviewResult;
  }

  const reviewFindingsResult = await tryHandleReviewFindingsRequest(userText, response, root);
  if (reviewFindingsResult) {
    return reviewFindingsResult;
  }

  const promoteFindingResult = await tryHandlePromoteFindingRequest(userText, response, agentx);
  if (promoteFindingResult) {
    return promoteFindingResult;
  }

  if (pending) {
    return resumePendingClarification(response, agentx, pending, userText);
  }

  response.markdown(renderUsageGuidance());
  return {};
}