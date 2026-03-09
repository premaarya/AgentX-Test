import { strict as assert } from 'assert';
import { createMockResponseStream } from '../mocks/vscode';
import { getAgentXChatFollowups, handleAgentXChatRequest } from '../../chat/chatParticipant';

describe('chatParticipant', () => {
  it('streams live CLI status lines into chat progress', async () => {
    const progressStream = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      runCliStreaming: async (
        _subcommand: string,
        _cliArgs: string[],
        onLine?: (line: string, source: 'stdout' | 'stderr') => void,
      ) => {
        onLine?.('  [COMPACTION] 8 messages pruned', 'stdout');
        onLine?.('  [CLARIFY 1/6] Asking architect about: auth flow', 'stdout');
        onLine?.('  [CLARIFY DETAIL] Use the existing auth provider and preserve refresh tokens.', 'stdout');
        onLine?.('  [SELF-REVIEW] Approved on iteration 1', 'stdout');
        return 'Final answer from AgentX';
      },
      clearPendingClarification: async () => undefined,
    };

    await handleAgentXChatRequest(
      { prompt: 'run engineer implement the login fix' } as any,
      progressStream as any,
      agentx as any,
    );

    const progressCalls = progressStream.calls
      .filter((call) => call.method === 'progress')
      .map((call) => String(call.args[0]));

    assert.ok(progressCalls.some((value) => value.includes('Running engineer agent...')));
    assert.ok(progressCalls.some((value) => value.includes('[COMPACTION]')));
    assert.ok(progressCalls.some((value) => value.includes('[CLARIFY 1/6]')));
    assert.ok(progressCalls.some((value) => value.includes('[CLARIFY DETAIL]')));
    assert.ok(progressCalls.some((value) => value.includes('[SELF-REVIEW] Approved')));
    assert.ok(progressStream.getMarkdown().includes('Final answer from AgentX'));
  });

  it('shows usage guidance for non-run prompts', async () => {
    const response = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
    };

    await handleAgentXChatRequest(
      { prompt: 'help me route this task' } as any,
      response as any,
      agentx as any,
    );

    assert.ok(response.getMarkdown().includes('During execution, live status updates'));
  });

  it('stores pending clarification and shows continue guidance when human input is required', async () => {
    const response = createMockResponseStream();
    let pending: unknown;
    const agentx = {
      checkInitialized: async () => true,
      runCliStreaming: async (
        _subcommand: string,
        _cliArgs: string[],
        onLine?: (line: string, source: 'stdout' | 'stderr') => void,
      ) => {
        onLine?.('  [HUMAN ESCALATION] Clarification not resolved after 6 iterations.', 'stdout');
        onLine?.('  [HUMAN REQUIRED SESSION] engineer-20260309120000-abcd', 'stdout');
        return 'Need your guidance on auth rollout.';
      },
      setPendingClarification: async (value: unknown) => { pending = value; },
      clearPendingClarification: async () => undefined,
    };

    await handleAgentXChatRequest(
      { prompt: 'run engineer implement the login fix' } as any,
      response as any,
      agentx as any,
    );

    assert.deepEqual(pending, {
      sessionId: 'engineer-20260309120000-abcd',
      agentName: 'engineer',
      prompt: 'implement the login fix',
      humanPrompt: 'Need your guidance on auth rollout.',
    });
    assert.ok(response.getMarkdown().includes('@agentx continue'));
  });

  it('resumes a pending clarification with continue', async () => {
    const response = createMockResponseStream();
    let cleared = false;
    let capturedArgs: string[] = [];
    const agentx = {
      checkInitialized: async () => true,
      getPendingClarification: async () => ({
        sessionId: 'engineer-20260309120000-abcd',
        agentName: 'engineer',
        prompt: 'implement the login fix',
      }),
      runCliStreaming: async (
        _subcommand: string,
        cliArgs: string[],
      ) => {
        capturedArgs = cliArgs;
        return 'Final answer after human clarification';
      },
      setPendingClarification: async () => undefined,
      clearPendingClarification: async () => { cleared = true; },
    };

    await handleAgentXChatRequest(
      { prompt: 'continue use the existing auth flow' } as any,
      response as any,
      agentx as any,
    );

    assert.deepEqual(capturedArgs, [
      '--resume-session', 'engineer-20260309120000-abcd',
      '--clarification-response', '"use the existing auth flow"',
    ]);
    assert.equal(cleared, true);
    assert.ok(response.getMarkdown().includes('Final answer after human clarification'));
  });

  it('shows pending clarification context for bare continue', async () => {
    const response = createMockResponseStream();
    const agentx = {
      checkInitialized: async () => true,
      getPendingClarification: async () => ({
        sessionId: 'engineer-20260309120000-abcd',
        agentName: 'engineer',
        prompt: 'implement the login fix',
        humanPrompt: 'Need your guidance on auth rollout.',
      }),
    };

    await handleAgentXChatRequest(
      { prompt: 'continue' } as any,
      response as any,
      agentx as any,
    );

    assert.ok(response.getMarkdown().includes('Pending clarification for engineer'));
    assert.ok(response.getMarkdown().includes('Need your guidance on auth rollout.'));
  });

  it('uses plain-language replies as clarification responses when one is pending', async () => {
    const response = createMockResponseStream();
    let capturedArgs: string[] = [];
    const agentx = {
      checkInitialized: async () => true,
      getPendingClarification: async () => ({
        sessionId: 'engineer-20260309120000-abcd',
        agentName: 'engineer',
        prompt: 'implement the login fix',
      }),
      runCliStreaming: async (
        _subcommand: string,
        cliArgs: string[],
      ) => {
        capturedArgs = cliArgs;
        return 'Resumed with natural-language clarification';
      },
      setPendingClarification: async () => undefined,
      clearPendingClarification: async () => undefined,
    };

    await handleAgentXChatRequest(
      { prompt: 'Use the existing auth flow and do not change token semantics.' } as any,
      response as any,
      agentx as any,
    );

    assert.deepEqual(capturedArgs, [
      '--resume-session', 'engineer-20260309120000-abcd',
      '--clarification-response', '"Use the existing auth flow and do not change token semantics."',
    ]);
    assert.ok(response.getMarkdown().includes('Resumed with natural-language clarification'));
  });

  it('returns follow-up suggestions when clarification is pending', async () => {
    const agentx = {
      getPendingClarification: async () => ({
        sessionId: 'engineer-20260309120000-abcd',
        agentName: 'engineer',
        prompt: 'implement the login fix',
      }),
    };

    const followups = await getAgentXChatFollowups(agentx as any);
    assert.equal(followups.length, 2);
    assert.equal(followups[0].prompt, 'continue');
    assert.ok(followups[0].label?.includes('engineer'));
    assert.equal(followups[1].prompt, 'clarification status');
  });
});