import * as vscode from 'vscode';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';
import {
  getAgentXChatFollowups,
  resetChatRouterStateForTests,
  routeAgentXChatRequest,
} from './requestRouter';

const PARTICIPANT_ID = 'agentx.chat';

export function resetChatParticipantStateForTests(): void {
  resetChatRouterStateForTests();
}

export { getAgentXChatFollowups };

export async function handleAgentXChatRequest(
  request: vscode.ChatRequest,
  response: vscode.ChatResponseStream,
  agentx: AgentXContext,
): Promise<vscode.ChatResult> {
  const initialized = await agentx.checkInitialized();
  if (!initialized) {
    return handleNotInitialized(response);
  }

  const userText = request.prompt.trim();
  if (!userText) {
    response.markdown('Please describe what you need AgentX to do.');
    return {};
  }

  return routeAgentXChatRequest(userText, response, agentx);
}

/**
 * Register the @agentx chat participant in Copilot Chat.
 */
export function registerChatParticipant(
  context: vscode.ExtensionContext,
  agentx: AgentXContext
): void {
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    _chatContext: vscode.ChatContext,
    response: vscode.ChatResponseStream,
    _token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> => {
    return handleAgentXChatRequest(request, response, agentx);
  };

  const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
  participant.iconPath = vscode.Uri.file(
    path.join(context.extensionPath, 'resources', 'icon.png')
  );
  participant.followupProvider = {
    provideFollowups: async () => getAgentXChatFollowups(agentx),
  };
  context.subscriptions.push(participant);
}

function handleNotInitialized(response: vscode.ChatResponseStream): vscode.ChatResult {
  response.markdown('**AgentX requires an open workspace folder.**\n\nOpen a folder in VS Code to get started.');
  return {};
}