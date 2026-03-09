import * as vscode from 'vscode';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';
import { stripAnsi } from '../utils/stripAnsi';

const PARTICIPANT_ID = 'agentx.chat';
const CHAT_OUTPUT_CHANNEL_NAME = 'AgentX Chat';
const CHAT_OUTPUT_INLINE_LIMIT = 4000;
const CHAT_OUTPUT_PREVIEW_LINES = 8;

const LIVE_STATUS_PATTERN = /\[(?:COMPACTION|CLARIFY(?: RESPONSE| DETAIL| \d+\/\d+)?|SELF-REVIEW|MODEL FALLBACK|LOOP WARNING|CIRCUIT BREAKER|TOOL ERROR|BOUNDARY BLOCKED|FAIL|WARN|PASS|HUMAN ESCALATION|HUMAN REQUIRED|HUMAN RESPONSE|HUMAN REQUIRED SESSION)\]|^\s*Iteration \d+\/\d+|^\s*Tool:/i;
const HUMAN_REQUIRED_SESSION_PATTERN = /\[HUMAN REQUIRED SESSION\]\s+(.+)$/i;

let chatOutputChannel: vscode.OutputChannel | undefined;

function normalizeCliLine(line: string): string {
  return stripAnsi(line).trim();
}

function shouldSurfaceCliLine(line: string): boolean {
  return LIVE_STATUS_PATTERN.test(line);
}

function buildContinueGuidance(agentName: string): string {
  return `Clarification is waiting for your input for the ${agentName} agent. Continue with:\n\n- \`@agentx continue "your guidance here"\``;
}

function getChatOutputChannel(): vscode.OutputChannel {
  if (!chatOutputChannel) {
    chatOutputChannel = vscode.window.createOutputChannel(CHAT_OUTPUT_CHANNEL_NAME);
  }
  return chatOutputChannel;
}

function formatOutputPreview(output: string): string {
  const normalized = stripAnsi(output).trim();
  if (!normalized) {
    return 'No output was produced.';
  }

  if (normalized.length <= CHAT_OUTPUT_INLINE_LIMIT) {
    return normalized;
  }

  const lines = normalized.split(/\r?\n/);
  const head = lines.slice(0, CHAT_OUTPUT_PREVIEW_LINES);
  const tail = lines.slice(-CHAT_OUTPUT_PREVIEW_LINES);
  const previewLines = [...head];

  if (lines.length > CHAT_OUTPUT_PREVIEW_LINES * 2) {
    previewLines.push(`... (${lines.length - (CHAT_OUTPUT_PREVIEW_LINES * 2)} lines omitted) ...`);
  }

  if (lines.length > CHAT_OUTPUT_PREVIEW_LINES) {
    previewLines.push(...tail);
  }

  return [
    `Large output detected (${lines.length} lines, ${normalized.length} chars). Full output was written to the **${CHAT_OUTPUT_CHANNEL_NAME}** output channel.`,
    '',
    'Preview:',
    '```text',
    previewLines.join('\n'),
    '```',
  ].join('\n');
}

function writeOutputToChannel(title: string, output: string): void {
  const channel = getChatOutputChannel();
  channel.clear();
  channel.appendLine(title);
  channel.appendLine('');
  channel.appendLine(stripAnsi(output));
}

function buildPendingClarificationMessage(
  pending: { agentName: string; prompt: string; humanPrompt?: string },
): string {
  const lines = [
    `**Pending clarification for ${pending.agentName}**`,
    '',
  ];

  if (pending.humanPrompt) {
    lines.push(pending.humanPrompt, '');
  }

  lines.push(
    `Original task: ${pending.prompt}`,
    '',
    'Reply in plain language with the guidance you want AgentX to use. You can also still use `@agentx continue "..."` explicitly.'
  );

  return lines.join('\n');
}

async function resumePendingClarification(
  response: vscode.ChatResponseStream,
  agentx: AgentXContext,
  pending: NonNullable<Awaited<ReturnType<AgentXContext['getPendingClarification']>>>,
  guidance: string,
): Promise<vscode.ChatResult> {
  try {
    response.progress(`Resuming ${pending.agentName} agent...`);
    let nextPendingSessionId = '';
    const output = await agentx.runCliStreaming(
      'run',
      [
        '--resume-session', pending.sessionId,
        '--clarification-response', `"${guidance.replace(/"/g, '\\"')}"`,
      ],
      (line) => {
        const normalized = normalizeCliLine(line);
        const sessionMatch = normalized.match(HUMAN_REQUIRED_SESSION_PATTERN);
        if (sessionMatch) {
          nextPendingSessionId = sessionMatch[1].trim();
        }
        if (normalized && shouldSurfaceCliLine(normalized)) {
          response.progress(normalized);
        }
      },
      { AGENTX_NONINTERACTIVE_HUMAN: '1' },
    );

    writeOutputToChannel(`AgentX Chat Resume: ${pending.agentName}`, output);

    if (nextPendingSessionId) {
      if (typeof agentx.setPendingClarification === 'function') {
        await agentx.setPendingClarification({
          sessionId: nextPendingSessionId,
          agentName: pending.agentName,
          prompt: pending.prompt,
          humanPrompt: stripAnsi(output),
        });
      }
      response.markdown(`${formatOutputPreview(output)}\n\n${buildContinueGuidance(pending.agentName)}`);
    } else {
      if (typeof agentx.clearPendingClarification === 'function') {
        await agentx.clearPendingClarification();
      }
      response.markdown(formatOutputPreview(output));
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    response.markdown(`**AgentX error:** ${msg}`);
  }
  return {};
}

export async function getAgentXChatFollowups(
  agentx: AgentXContext,
): Promise<vscode.ChatFollowup[]> {
  const pending = typeof agentx.getPendingClarification === 'function'
    ? await agentx.getPendingClarification()
    : undefined;
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

export function resetChatParticipantStateForTests(): void {
  chatOutputChannel = undefined;
}

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

  const runMatch = userText.match(/^run\s+(\S+)\s+(.+)$/is);
  if (runMatch) {
    const agentName = runMatch[1].toLowerCase();
    const task = runMatch[2].trim();
    try {
      response.progress(`Running ${agentName} agent...`);
      let pendingSessionId = '';
      const output = await agentx.runCliStreaming(
        'run',
        [agentName, `"${task.replace(/"/g, '\\"')}"`],
        (line) => {
          const normalized = normalizeCliLine(line);
          const sessionMatch = normalized.match(HUMAN_REQUIRED_SESSION_PATTERN);
          if (sessionMatch) {
            pendingSessionId = sessionMatch[1].trim();
          }
          if (normalized && shouldSurfaceCliLine(normalized)) {
            response.progress(normalized);
          }
        },
        { AGENTX_NONINTERACTIVE_HUMAN: '1' },
      );

      writeOutputToChannel(`AgentX Chat Run: ${agentName}`, output);

      if (pendingSessionId) {
        if (typeof agentx.setPendingClarification === 'function') {
          await agentx.setPendingClarification({
            sessionId: pendingSessionId,
            agentName,
            prompt: task,
            humanPrompt: stripAnsi(output),
          });
        }
        response.markdown(`${formatOutputPreview(output)}\n\n${buildContinueGuidance(agentName)}`);
      } else {
        if (typeof agentx.clearPendingClarification === 'function') {
          await agentx.clearPendingClarification();
        }
        response.markdown(formatOutputPreview(output));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      response.markdown(`**AgentX error:** ${msg}`);
    }
    return {};
  }

  const pending = typeof agentx.getPendingClarification === 'function'
    ? await agentx.getPendingClarification()
    : undefined;

  if (/^(clarification status|pending clarification)$/i.test(userText)) {
    if (!pending) {
      response.markdown('There is no pending clarification right now.');
      return {};
    }

    response.markdown(buildPendingClarificationMessage(pending));
    return {};
  }

  const continueMatch = userText.match(/^continue(?:\s+(.+))?$/is);
  if (continueMatch) {
    if (!pending) {
      response.markdown('There is no pending clarification to continue. Start a run first.');
      return {};
    }

    const guidance = continueMatch[1]?.trim();
    if (!guidance) {
      response.markdown(buildPendingClarificationMessage(pending));
      return {};
    }

    return resumePendingClarification(response, agentx, pending, guidance);
  }

  if (pending) {
    return resumePendingClarification(response, agentx, pending, userText);
  }

  response.markdown(
    '**AgentX** - Multi-Agent Orchestration\n\n'
    + 'Usage:\n'
    + '- `@agentx run engineer "implement the health endpoint for issue #42"`\n'
    + '- `@agentx continue "use the existing auth flow and keep refresh tokens"`\n'
    + '- `@agentx run architect "design the auth system"`\n'
    + '- `@agentx run reviewer "review the changes in issue #42"`\n\n'
    + 'During execution, live status updates for compaction, clarification, loop progress, tool activity, and self-review are streamed into chat.'
  );
  return {};
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