import { strict as assert } from 'assert';
import {
  spawnSubAgent,
  spawnSubAgentWithHistory,
  SubAgentConfig,
  LlmAdapterFactory,
  AgentLoader,
} from '../../agentic/subAgentSpawner';
import { LlmAdapter, LlmResponse, SessionMessage } from '../../agentic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFakeAdapter(responseText: string): LlmAdapter {
  return {
    async chat(): Promise<LlmResponse> {
      return { text: responseText, toolCalls: [] };
    },
  };
}

function createFakeLlmFactory(adapter: LlmAdapter): LlmAdapterFactory {
  return async () => adapter;
}

function createFakeAgentLoader(
  defOverrides?: { name?: string; description?: string; model?: string },
  instructionsText?: string,
): AgentLoader {
  return {
    async loadDef(role: string) {
      return {
        name: defOverrides?.name ?? role,
        description: defOverrides?.description ?? `Test ${role} agent.`,
        model: defOverrides?.model ?? 'test-model',
      };
    },
    async loadInstructions(_role: string) {
      return instructionsText ?? '## Role\nTest role instructions.\n## Constraints\nNo constraints.';
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SubAgentSpawner', () => {
  describe('spawnSubAgent', () => {
    it('should spawn a sub-agent and return its text response', async () => {
      const adapter = createFakeAdapter('Sub-agent response text');
      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const config: SubAgentConfig = {
        role: 'reviewer',
        workspaceRoot: '/tmp/test',
      };

      const result = await spawnSubAgent(
        config,
        'Review this code',
        factory,
        loader,
        signal,
      );

      assert.ok(result.response.includes('Sub-agent response'));
      assert.equal(result.exitReason, 'text_response');
      assert.ok(result.iterations >= 1);
      assert.ok(result.durationMs >= 0);
    });

    it('should return fallback when LLM adapter is null', async () => {
      const factory: LlmAdapterFactory = async () => null;
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const config: SubAgentConfig = {
        role: 'architect',
        workspaceRoot: '/tmp/test',
      };

      const result = await spawnSubAgent(
        config,
        'Design the system',
        factory,
        loader,
        signal,
      );

      assert.ok(result.response.includes('not available'));
      assert.equal(result.exitReason, 'error');
    });

    it('should respect maxIterations config', async () => {
      let callCount = 0;
      const adapter: LlmAdapter = {
        async chat(): Promise<LlmResponse> {
          callCount++;
          // Always return tool calls to force iteration
          if (callCount < 3) {
            return {
              text: '',
              toolCalls: [{ id: `tc-${callCount}`, name: 'list_dir', arguments: { dirPath: '.' } }],
            };
          }
          return { text: 'Finally done', toolCalls: [] };
        },
      };

      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const config: SubAgentConfig = {
        role: 'engineer',
        maxIterations: 5,
        workspaceRoot: '/tmp/test',
      };

      const result = await spawnSubAgent(config, 'Do work', factory, loader, signal);
      assert.ok(result.iterations >= 2);
    });
  });

  describe('spawnSubAgentWithHistory', () => {
    it('should include prior conversation history', async () => {
      let receivedMessages: readonly SessionMessage[] = [];
      const adapter: LlmAdapter = {
        async chat(messages: readonly SessionMessage[]): Promise<LlmResponse> {
          receivedMessages = messages;
          return { text: 'Done with history', toolCalls: [] };
        },
      };

      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const config: SubAgentConfig = {
        role: 'reviewer',
        workspaceRoot: '/tmp/test',
      };

      const history: SessionMessage[] = [
        { role: 'user', content: 'Previous question', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Previous answer', timestamp: new Date().toISOString() },
      ];

      const result = await spawnSubAgentWithHistory(
        config,
        history,
        factory,
        loader,
        signal,
      );

      assert.ok(result.response.includes('Done with history'));
      // The adapter should receive system + history + new prompt
      assert.ok(receivedMessages.length >= 3);
    });
  });
});
