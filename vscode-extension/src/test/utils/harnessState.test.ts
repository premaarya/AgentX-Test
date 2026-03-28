import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  addHarnessContractFinding,
  completeHarnessThread,
  findDefaultExecutionPlanPath,
  getActiveHarnessContract,
  getHarnessContractFindings,
  getHarnessStatusDisplay,
  readHarnessState,
  recordHarnessIteration,
  recordHarnessStatusCheck,
  setHarnessContractState,
  startHarnessThread,
} from '../../utils/harnessState';

function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-harness-'));
  fs.mkdirSync(path.join(root, '.agentx', 'state'), { recursive: true });
  return root;
}

describe('harnessState', () => {
  let wsRoot: string;

  beforeEach(() => {
    wsRoot = makeWorkspace();
  });

  afterEach(() => {
    fs.rmSync(wsRoot, { recursive: true, force: true });
  });

  it('returns an empty default state when file does not exist', () => {
    const state = readHarnessState(wsRoot);
    assert.equal(state.version, 1);
    assert.equal(state.threads.length, 0);
    assert.equal(state.turns.length, 0);
  });

  it('finds a default execution plan under docs/plans', () => {
    fs.mkdirSync(path.join(wsRoot, 'docs', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(wsRoot, 'docs', 'plans', 'demo.md'), '# Demo\n');

    assert.equal(findDefaultExecutionPlanPath(wsRoot), 'docs/plans/demo.md');
  });

  it('starts a harness thread and creates an active turn', () => {
    const thread = startHarnessThread(wsRoot, {
      taskType: 'iterative-loop',
      title: 'Iterative Loop',
      prompt: 'Implement feature',
      completionCriteria: 'ALL_TESTS_PASSING',
      issueNumber: 42,
    });

    const state = readHarnessState(wsRoot);
    assert.equal(state.threads.length, 1);
    assert.equal(state.turns.length, 1);
    assert.equal(thread.status, 'active');
    assert.equal(state.turns[0].status, 'active');
    assert.equal(state.items.length >= 1, true);
    assert.equal(state.evidence.length, 1);
  });

  it('records iterations by completing the current turn and creating the next one', () => {
    startHarnessThread(wsRoot, {
      taskType: 'iterative-loop',
      title: 'Iterative Loop',
      prompt: 'Implement feature',
    });

    recordHarnessIteration(wsRoot, 'Fixed failing tests');

    const state = readHarnessState(wsRoot);
    assert.equal(state.turns.length, 2);
    assert.equal(state.turns[0].status, 'complete');
    assert.equal(state.turns[1].status, 'active');
    assert.equal(state.evidence.some((entry) => entry.summary === 'Fixed failing tests'), true);
  });

  it('records status checks without changing the active turn', () => {
    startHarnessThread(wsRoot, {
      taskType: 'iterative-loop',
      title: 'Iterative Loop',
      prompt: 'Implement feature',
    });

    recordHarnessStatusCheck(wsRoot, 'Loop status requested');

    const state = readHarnessState(wsRoot);
    assert.equal(state.turns.length, 1);
    assert.equal(state.items.some((entry) => entry.summary === 'Loop status requested'), true);
  });

  it('completes the active thread and marks the turn complete', () => {
    startHarnessThread(wsRoot, {
      taskType: 'iterative-loop',
      title: 'Iterative Loop',
      prompt: 'Implement feature',
    });

    completeHarnessThread(wsRoot, {
      status: 'complete',
      summary: 'All tests passing',
    });

    const state = readHarnessState(wsRoot);
    assert.equal(state.threads[0].status, 'complete');
    assert.equal(state.turns[0].status, 'complete');
    assert.equal(state.evidence.some((entry) => entry.summary === 'All tests passing'), true);
  });

  it('returns a compact active harness status string', () => {
    startHarnessThread(wsRoot, {
      taskType: 'iterative-loop',
      title: 'Iterative Loop',
      prompt: 'Implement feature',
    });

    const display = getHarnessStatusDisplay(wsRoot);
    assert.ok(display.includes('Harness iterative-loop turn 1'));
  });

  it('persists active contract state alongside the current harness thread', () => {
    startHarnessThread(wsRoot, {
      taskType: 'story',
      title: 'Implement bounded work slice',
      prompt: 'Implement contract runtime support',
      issueNumber: 253,
    });

    const contract = setHarnessContractState(wsRoot, {
      contractPath: 'docs/execution/contracts/CONTRACT-253-runtime.md',
      evidencePath: 'docs/execution/contracts/EVIDENCE-253-runtime.md',
      status: 'Active',
      title: 'Runtime contract support',
      nextAction: 'Attach evaluator findings before review',
    });

    const state = readHarnessState(wsRoot);
    assert.equal(state.contracts.length, 1);
    assert.equal(contract.status, 'Active');
    assert.equal(getActiveHarnessContract(wsRoot)?.contractPath, 'docs/execution/contracts/CONTRACT-253-runtime.md');
  });

  it('attaches evaluator findings to the active contract with severity and next action', () => {
    startHarnessThread(wsRoot, {
      taskType: 'story',
      title: 'Implement bounded work slice',
      prompt: 'Implement contract runtime support',
      issueNumber: 253,
    });
    const contract = setHarnessContractState(wsRoot, {
      contractPath: 'docs/execution/contracts/CONTRACT-253-runtime.md',
      status: 'Blocked',
      title: 'Runtime contract support',
      blocker: 'Evaluator finding unresolved',
    });

    addHarnessContractFinding(wsRoot, {
      contractPath: 'docs/execution/contracts/CONTRACT-253-runtime.md',
      severity: 'high',
      summary: 'Runtime proof is missing for the active slice',
      nextAction: 'Run the real-surface verification before advancing to review',
    });

    const findings = getHarnessContractFindings(wsRoot, contract.id);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].nextAction, 'Run the real-surface verification before advancing to review');
  });
});