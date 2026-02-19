import * as vscode from 'vscode';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';
import { handleSlashCommand, AgentXChatMetadata } from './commandHandlers';
import { routeNaturalLanguage } from './agentRouter';
import { AgentXFollowupProvider } from './followupProvider';

const PARTICIPANT_ID = 'agentx.chat';

/**
 * Register the @agentx chat participant in Copilot Chat.
 */
export function registerChatParticipant(
  context: vscode.ExtensionContext,
  agentx: AgentXContext
): void {
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    chatContext: vscode.ChatContext,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> => {
    // Check initialization
    const initialized = await agentx.checkInitialized();

    if (!initialized) {
      return handleNotInitialized(response);
    }

    // Slash command -> dispatch to command handler
    if (request.command) {
      return handleSlashCommand(request, chatContext, response, token, agentx);
    }

    // Natural language -> classify and route to agent
    return routeNaturalLanguage(request, chatContext, response, token, agentx);
  };

  const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
  participant.iconPath = vscode.Uri.file(
    path.join(context.extensionPath, 'resources', 'icon.png')
  );
  participant.followupProvider = new AgentXFollowupProvider(agentx);

  context.subscriptions.push(participant);
}

function handleNotInitialized(
  response: vscode.ChatResponseStream
): vscode.ChatResult {
  response.markdown(
    '**AgentX is not initialized in this workspace.**\n\n'
    + 'Click below to open the setup wizard:\n\n'
  );
  response.button({
    command: 'agentx.initialize',
    title: '$(rocket) Open Setup Wizard',
  });
  response.markdown(
    '\nThe wizard will guide you through:\n'
    + '1. Choosing **Local** or **GitHub** mode\n'
    + '2. Configuring your repository (GitHub mode)\n'
    + '3. Installing the AgentX framework files\n\n'
    + 'Once initialized, you can:\n'
    + '- Ask me to route work to the right agent\n'
    + '- Use `/ready` to see unblocked work\n'
    + '- Use `/workflow feature` to run a workflow\n'
    + '- Use `/status` to check agent states\n'
  );
  return { metadata: { initialized: false } as AgentXChatMetadata };
}
