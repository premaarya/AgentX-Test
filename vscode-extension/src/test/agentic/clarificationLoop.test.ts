import { strict as assert } from 'assert';
import {
  runClarificationLoop,
  getDefaultClarificationConfig,
  ClarificationLoopConfig,
  ClarificationEvaluator,
} from '../../agentic/clarificationLoop';
import { LlmAdapterFactory, AgentLoader } from '../../agentic/subAgentSpawner';
import { LlmAdapter, LlmResponse } from '../../agentic';

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

function createFakeAgentLoader(): AgentLoader {
  return {
    async loadDef(role: string) {
      return { name: role, description: `Test ${role} agent.`, model: 'test-model' };
    },
    async loadInstructions() {
      return '## Role\nTest instructions.';
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClarificationLoop', () => {
  describe('getDefaultClarificationConfig', () => {
    it('should return config with default values', () => {
      const config = getDefaultClarificationConfig('/tmp/test');
      assert.equal(config.maxIterations, 6);
      assert.equal(config.responderMaxIterations, 5);
      assert.equal(config.responderTokenBudget, 20_000);
    });
  });

  describe('runClarificationLoop', () => {
    it('should resolve on first iteration with a good answer', async () => {
      const adapter = createFakeAdapter(
        'The architecture uses a microservices pattern with API Gateway for routing. '
        + 'Each service communicates via async message queues for decoupling.',
      );
      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const config: ClarificationLoopConfig = {
        ...getDefaultClarificationConfig('/tmp/test'),
        workspaceRoot: '/tmp/test',
      };

      const result = await runClarificationLoop(
        config,
        'engineer',
        'architect',
        'system design',
        'What architecture pattern should we use for the notification service?',
        factory,
        loader,
        signal,
      );

      assert.equal(result.resolved, true);
      assert.equal(result.iterations, 1);
      assert.equal(result.escalatedToHuman, false);
      assert.ok(result.answer.length > 50);
    });

    it('should iterate when answer is insufficient', async () => {
      let callCount = 0;
      const adapter: LlmAdapter = {
        async chat(): Promise<LlmResponse> {
          callCount++;
          if (callCount === 1) {
            return { text: 'I am not sure.', toolCalls: [] };
          }
          return {
            text: 'After researching the codebase, the notification service should use event-driven architecture with a message broker.',
            toolCalls: [],
          };
        },
      };

      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const config: ClarificationLoopConfig = {
        ...getDefaultClarificationConfig('/tmp/test'),
        maxIterations: 3,
        workspaceRoot: '/tmp/test',
      };

      const result = await runClarificationLoop(
        config,
        'engineer',
        'architect',
        'architecture',
        'What pattern for notifications?',
        factory,
        loader,
        signal,
      );

      assert.equal(result.resolved, true);
      assert.ok(result.iterations >= 2, 'should take at least 2 iterations');
    });

    it('should escalate to human after max iterations', async () => {
      const adapter = createFakeAdapter('I do not know.');
      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      let humanFallbackCalled = false;
      const config: ClarificationLoopConfig = {
        ...getDefaultClarificationConfig('/tmp/test'),
        maxIterations: 2,
        workspaceRoot: '/tmp/test',
        onHumanFallback: async (_topic: string, _context: string) => {
          humanFallbackCalled = true;
          return 'Use event sourcing pattern.';
        },
      };

      const result = await runClarificationLoop(
        config,
        'engineer',
        'architect',
        'architecture',
        'What pattern?',
        factory,
        loader,
        signal,
      );

      assert.equal(result.escalatedToHuman, true);
      assert.ok(humanFallbackCalled, 'human fallback should be called');
      assert.ok(result.answer.includes('event sourcing'));
    });

    it('should use custom evaluator when provided', async () => {
      const adapter = createFakeAdapter('Custom evaluated answer');
      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      let evaluatorCalled = false;
      const customEvaluator: ClarificationEvaluator = (
        _question: string,
        _answer: string,
        _iteration: number,
      ) => {
        evaluatorCalled = true;
        return { resolved: true };
      };

      const config: ClarificationLoopConfig = {
        ...getDefaultClarificationConfig('/tmp/test'),
        workspaceRoot: '/tmp/test',
      };

      const result = await runClarificationLoop(
        config,
        'engineer',
        'architect',
        'design',
        'How to implement?',
        factory,
        loader,
        signal,
        customEvaluator,
      );

      assert.ok(evaluatorCalled, 'custom evaluator should be called');
      assert.equal(result.resolved, true);
    });

    it('should call progress callbacks', async () => {
      const adapter = createFakeAdapter(
        'Here is a detailed answer about the design pattern with sufficient context and explanation.',
      );
      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      let iterationCalled = false;
      let responseCalled = false;

      const config: ClarificationLoopConfig = {
        ...getDefaultClarificationConfig('/tmp/test'),
        workspaceRoot: '/tmp/test',
      };

      await runClarificationLoop(
        config,
        'engineer',
        'architect',
        'design',
        'How should we structure the API?',
        factory,
        loader,
        signal,
        undefined,
        {
          onClarificationIteration: () => { iterationCalled = true; },
          onSubAgentResponse: () => { responseCalled = true; },
          onHumanEscalation: () => {},
        },
      );

      assert.ok(iterationCalled, 'onClarificationIteration should be called');
      assert.ok(responseCalled, 'onSubAgentResponse should be called');
    });

    it('should handle LLM adapter unavailability gracefully', async () => {
      const factory: LlmAdapterFactory = async () => null;
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const config: ClarificationLoopConfig = {
        ...getDefaultClarificationConfig('/tmp/test'),
        workspaceRoot: '/tmp/test',
      };

      const result = await runClarificationLoop(
        config,
        'engineer',
        'architect',
        'design',
        'Question?',
        factory,
        loader,
        signal,
      );

      // Should handle gracefully -- not crash
      assert.equal(result.resolved, false);
      assert.equal(result.escalatedToHuman, true);
    });
  });
});
