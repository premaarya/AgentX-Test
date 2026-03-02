import { strict as assert } from 'assert';
import {
  runSelfReview,
  parseReviewResponse,
  getDefaultSelfReviewConfig,
  SelfReviewConfig,
  ReviewFinding,
} from '../../agentic/selfReviewLoop';
import { LlmAdapterFactory, AgentLoader } from '../../agentic/subAgentSpawner';
import { LlmAdapter, LlmResponse } from '../../agentic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createReviewAdapter(reviewText: string): LlmAdapter {
  return {
    async chat(): Promise<LlmResponse> {
      return { text: reviewText, toolCalls: [] };
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

describe('SelfReviewLoop', () => {
  describe('parseReviewResponse', () => {
    it('should parse structured APPROVED: true response', () => {
      const text = `
Here is my review:

\`\`\`review
APPROVED: true
FINDINGS:
- [LOW] style: Consider using const instead of let
\`\`\`
`;
      const result = parseReviewResponse(text);
      assert.equal(result.approved, true);
      assert.equal(result.findings.length, 1);
      assert.equal(result.findings[0].impact, 'low');
      assert.equal(result.findings[0].category, 'style');
    });

    it('should parse structured APPROVED: false with multiple findings', () => {
      const text = `
\`\`\`review
APPROVED: false
FINDINGS:
- [HIGH] security: SQL injection vulnerability in query builder
- [MEDIUM] testing: Missing unit tests for edge cases
- [LOW] naming: Variable names could be more descriptive
\`\`\`
`;
      const result = parseReviewResponse(text);
      assert.equal(result.approved, false);
      assert.equal(result.findings.length, 3);
      assert.equal(result.findings[0].impact, 'high');
      assert.equal(result.findings[1].impact, 'medium');
      assert.equal(result.findings[2].impact, 'low');
    });

    it('should handle freeform rejection without structured block', () => {
      const text = 'This code has critical issues and needs changes. The implementation is not correct.';
      const result = parseReviewResponse(text);
      assert.equal(result.approved, false);
    });

    it('should default to approved for neutral freeform text', () => {
      const text = 'The implementation looks good overall. Nice work on the test coverage.';
      const result = parseReviewResponse(text);
      assert.equal(result.approved, true);
    });
  });

  describe('getDefaultSelfReviewConfig', () => {
    it('should return config with default values', () => {
      const config = getDefaultSelfReviewConfig('engineer', '/tmp/test');
      assert.equal(config.maxIterations, 15);
      assert.equal(config.reviewerMaxIterations, 8);
      assert.equal(config.reviewerTokenBudget, 30_000);
      assert.equal(config.reviewerCanWrite, false);
    });
  });

  describe('runSelfReview', () => {
    it('should return approved when reviewer approves', async () => {
      const reviewText = '```review\nAPPROVED: true\nFINDINGS:\n- [LOW] minor: small suggestion\n```';
      const adapter = createReviewAdapter(reviewText);
      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const config: SelfReviewConfig = {
        ...getDefaultSelfReviewConfig('engineer', '/tmp/test'),
        role: 'engineer',
        workspaceRoot: '/tmp/test',
      };

      const result = await runSelfReview(
        config,
        'I completed the implementation of the login feature.',
        factory,
        loader,
        signal,
      );

      assert.equal(result.approved, true);
      assert.equal(result.iterations, 1);
    });

    it('should return not approved with feedback when HIGH findings exist', async () => {
      const reviewText = '```review\nAPPROVED: false\nFINDINGS:\n- [HIGH] bug: Missing null check causes crash\n```';
      const adapter = createReviewAdapter(reviewText);
      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const config: SelfReviewConfig = {
        ...getDefaultSelfReviewConfig('engineer', '/tmp/test'),
        role: 'engineer',
        workspaceRoot: '/tmp/test',
      };

      const result = await runSelfReview(
        config,
        'I completed the feature.',
        factory,
        loader,
        signal,
      );

      assert.equal(result.approved, false);
      assert.ok(result.allFindings.length > 0);
      assert.ok(result.allFindings.some((f: ReviewFinding) => f.impact === 'high'));
    });

    it('should call progress callbacks', async () => {
      const reviewText = '```review\nAPPROVED: true\nFINDINGS:\n```';
      const adapter = createReviewAdapter(reviewText);
      const factory = createFakeLlmFactory(adapter);
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      let reviewStartCalled = false;
      let reviewCompleteCalled = false;

      const config: SelfReviewConfig = {
        ...getDefaultSelfReviewConfig('engineer', '/tmp/test'),
        role: 'engineer',
        workspaceRoot: '/tmp/test',
      };

      await runSelfReview(
        config,
        'Done.',
        factory,
        loader,
        signal,
        {
          onReviewIteration: () => { reviewStartCalled = true; },
          onApproved: () => { reviewCompleteCalled = true; },
        },
      );

      assert.ok(reviewStartCalled, 'onReviewIteration should be called');
      assert.ok(reviewCompleteCalled, 'onApproved should be called');
    });

    it('should auto-approve when LLM adapter is unavailable', async () => {
      const factory: LlmAdapterFactory = async () => null;
      const loader = createFakeAgentLoader();
      const signal = new AbortController().signal;

      const config: SelfReviewConfig = {
        ...getDefaultSelfReviewConfig('engineer', '/tmp/test'),
        role: 'engineer',
        workspaceRoot: '/tmp/test',
      };

      const result = await runSelfReview(
        config,
        'Done.',
        factory,
        loader,
        signal,
      );

      // Should gracefully handle missing adapter
      assert.equal(result.approved, true);
    });
  });
});
