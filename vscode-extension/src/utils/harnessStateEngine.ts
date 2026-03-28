import * as fs from 'fs';
import * as path from 'path';
import {
 createDefaultState,
 findMarkdownFiles,
 getActiveThread,
 getActiveTurn,
 makeId,
 nowIso,
 replaceThread,
 replaceTurn,
 toPosixRelative,
 writeHarnessState,
} from './harnessStateInternals';
import type {
 AddHarnessContractFindingOptions,
 CompleteHarnessThreadOptions,
 HarnessContract,
 HarnessContractFinding,
 HarnessEvidence,
 HarnessItem,
 HarnessState,
 HarnessThread,
 HarnessTurn,
 SetHarnessContractStateOptions,
 StartHarnessThreadOptions,
} from './harnessStateTypes';

export function readHarnessState(workspaceRoot: string): HarnessState {
 const filePath = path.join(workspaceRoot, '.agentx', 'state', 'harness-state.json');
 try {
  if (!fs.existsSync(filePath)) {
   return createDefaultState();
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<HarnessState>;
  return {
   version: 1,
   threads: parsed.threads ?? [],
   turns: parsed.turns ?? [],
   items: parsed.items ?? [],
   evidence: parsed.evidence ?? [],
   contracts: parsed.contracts ?? [],
   contractFindings: parsed.contractFindings ?? [],
  };
 } catch {
  return createDefaultState();
 }
}

export function getActiveHarnessContract(workspaceRoot: string): HarnessContract | undefined {
 const state = readHarnessState(workspaceRoot);
 const thread = getActiveThread(state);
 if (!thread) {
  return undefined;
 }

 return [...state.contracts]
  .reverse()
  .find((contract) => contract.threadId === thread.id && contract.status !== 'Superseded');
}

export function getHarnessContractFindings(
 workspaceRoot: string,
 contractId: string,
): HarnessContractFinding[] {
 const state = readHarnessState(workspaceRoot);
 return state.contractFindings.filter((finding) => finding.contractId === contractId);
}

export function findDefaultExecutionPlanPath(workspaceRoot: string): string | undefined {
 // Canonical location per docs/WORKFLOW.md is docs/execution/plans/.
 // Legacy docs/plans/ is checked as a fallback for older workspaces.
 const canonicalPlansDir = path.join(workspaceRoot, 'docs', 'execution', 'plans');
 const legacyPlansDir = path.join(workspaceRoot, 'docs', 'plans');
 const candidates: string[] = [];
 findMarkdownFiles(canonicalPlansDir, candidates);

 if (candidates.length === 0) {
  findMarkdownFiles(legacyPlansDir, candidates);
 }

 if (candidates.length === 0) {
  const docsDir = path.join(workspaceRoot, 'docs');
  findMarkdownFiles(docsDir, candidates);
 }

 return candidates
  .map((candidate) => toPosixRelative(workspaceRoot, candidate))
  .sort()
  .find(
   (candidate) =>
    candidate.startsWith('docs/execution/plans/') ||
    candidate.startsWith('docs/plans/') ||
    /(^|\/)EXEC-PLAN.+\.md$/i.test(candidate),
  );
}

export function startHarnessThread(
 workspaceRoot: string,
 options: StartHarnessThreadOptions,
): HarnessThread {
 let state = readHarnessState(workspaceRoot);
 const existingThread = getActiveThread(state);
 if (existingThread) {
  return existingThread;
 }

 const createdAt = nowIso();
 const threadId = makeId('thread', state.threads.length);
 const turnId = makeId('turn', state.turns.length);
 const planPath = options.planPath ?? findDefaultExecutionPlanPath(workspaceRoot);

 const thread: HarnessThread = {
  id: threadId,
  title: options.title,
  taskType: options.taskType,
  status: 'active',
  issueNumber: options.issueNumber,
  planPath,
  startedAt: createdAt,
  updatedAt: createdAt,
  currentTurnId: turnId,
 };

 const turn: HarnessTurn = {
  id: turnId,
  threadId,
  sequence: 1,
  status: 'active',
  startedAt: createdAt,
 };

 const items: HarnessItem[] = [
  {
   id: makeId('item', state.items.length),
   threadId,
   turnId,
   itemType: 'command',
   summary: `Started ${options.taskType} harness thread`,
   createdAt,
   metadata: {
    completionCriteria: options.completionCriteria ?? null,
    prompt: options.prompt ?? null,
   },
  },
 ];

 if (planPath) {
  items.push({
   id: makeId('item', state.items.length + items.length),
   threadId,
   turnId,
   itemType: 'status',
   summary: `Linked execution plan: ${planPath}`,
   createdAt,
  });
 }

 const evidence: HarnessEvidence = {
  id: makeId('evidence', state.evidence.length),
  threadId,
  turnId,
  evidenceType: 'loop-output',
  summary: options.prompt ?? options.title,
  createdAt,
 };

 state = {
  ...state,
  threads: [...state.threads, thread],
  turns: [...state.turns, turn],
  items: [...state.items, ...items],
  evidence: [...state.evidence, evidence],
 };

 writeHarnessState(workspaceRoot, state);
 return thread;
}

export function recordHarnessStatusCheck(workspaceRoot: string, summary: string): void {
 const state = readHarnessState(workspaceRoot);
 const thread = getActiveThread(state);
 if (!thread) {
  return;
 }

 const turn = getActiveTurn(state, thread.id);
 const createdAt = nowIso();
 const nextState: HarnessState = {
  ...state,
  items: [
   ...state.items,
   {
    id: makeId('item', state.items.length),
    threadId: thread.id,
    turnId: turn?.id,
    itemType: 'status',
    summary,
    createdAt,
   },
  ],
  evidence: [
   ...state.evidence,
   {
    id: makeId('evidence', state.evidence.length),
    threadId: thread.id,
    turnId: turn?.id,
    evidenceType: 'status-check',
    summary,
    createdAt,
   },
  ],
 };

 writeHarnessState(workspaceRoot, nextState);
}

export function recordHarnessIteration(workspaceRoot: string, summary: string): void {
 let state = readHarnessState(workspaceRoot);
 let thread = getActiveThread(state);

 if (!thread) {
  thread = startHarnessThread(workspaceRoot, {
   taskType: 'iterative-loop',
   title: 'Iterative Loop',
   prompt: summary,
  });
  state = readHarnessState(workspaceRoot);
 }

 const currentTurn = getActiveTurn(state, thread.id);
 const createdAt = nowIso();
 let nextState = state;

 let nextSequence = 1;
 if (currentTurn) {
  nextSequence = currentTurn.sequence + 1;
  nextState = replaceTurn(nextState, {
   ...currentTurn,
   status: 'complete',
   completedAt: createdAt,
   summary,
  });
 }

 const nextTurn: HarnessTurn = {
  id: makeId('turn', nextState.turns.length),
  threadId: thread.id,
  sequence: nextSequence,
  status: 'active',
  startedAt: createdAt,
 };

 nextState = replaceThread(nextState, {
  ...thread,
  updatedAt: createdAt,
  currentTurnId: nextTurn.id,
 });

 nextState = {
  ...nextState,
  turns: [...nextState.turns, nextTurn],
  items: [
   ...nextState.items,
   {
    id: makeId('item', nextState.items.length),
    threadId: thread.id,
    turnId: nextTurn.id,
    itemType: 'iteration',
    summary,
    createdAt,
   },
  ],
  evidence: [
   ...nextState.evidence,
   {
    id: makeId('evidence', nextState.evidence.length),
    threadId: thread.id,
    turnId: nextTurn.id,
    evidenceType: 'iteration-summary',
    summary,
    createdAt,
   },
  ],
 };

 writeHarnessState(workspaceRoot, nextState);
}

export function setHarnessContractState(
 workspaceRoot: string,
 options: SetHarnessContractStateOptions,
): HarnessContract {
 const state = readHarnessState(workspaceRoot);
 const thread = getActiveThread(state);
 if (!thread) {
  throw new Error('No active harness thread exists for storing contract state.');
 }

 const turn = getActiveTurn(state, thread.id);
 const createdAt = nowIso();
 const existing = [...state.contracts]
  .reverse()
  .find((contract) => contract.threadId === thread.id && contract.contractPath === options.contractPath);

 const contract: HarnessContract = existing
  ? {
   ...existing,
   evidencePath: options.evidencePath ?? existing.evidencePath,
   status: options.status,
   title: options.title,
   summary: options.summary,
   nextAction: options.nextAction,
   blocker: options.blocker,
   turnId: turn?.id,
   updatedAt: createdAt,
  }
  : {
   id: makeId('contract', state.contracts.length),
   threadId: thread.id,
   turnId: turn?.id,
   contractPath: options.contractPath,
   evidencePath: options.evidencePath,
   status: options.status,
   title: options.title,
   summary: options.summary,
   nextAction: options.nextAction,
   blocker: options.blocker,
   createdAt,
   updatedAt: createdAt,
  };

 const contracts = existing
  ? state.contracts.map((candidate) => candidate.id === existing.id ? contract : candidate)
  : [...state.contracts, contract];

 writeHarnessState(workspaceRoot, {
  ...state,
  contracts,
  items: [
   ...state.items,
   {
    id: makeId('item', state.items.length),
    threadId: thread.id,
    turnId: turn?.id,
    itemType: 'status',
    summary: `Contract ${options.status}: ${options.contractPath}`,
    createdAt,
    metadata: {
     contractPath: options.contractPath,
     nextAction: options.nextAction ?? null,
     blocker: options.blocker ?? null,
    },
   },
  ],
 });

 return contract;
}

export function addHarnessContractFinding(
 workspaceRoot: string,
 options: AddHarnessContractFindingOptions,
): HarnessContractFinding {
 const contract = getActiveHarnessContract(workspaceRoot);
 if (!contract || contract.contractPath !== options.contractPath) {
  throw new Error('The requested contract is not the active harness contract.');
 }

 const state = readHarnessState(workspaceRoot);
 const createdAt = nowIso();
 const finding: HarnessContractFinding = {
  id: makeId('contract-finding', state.contractFindings.length),
  contractId: contract.id,
  threadId: contract.threadId,
  turnId: contract.turnId,
  severity: options.severity,
  summary: options.summary,
  nextAction: options.nextAction,
  createdAt,
 };

 writeHarnessState(workspaceRoot, {
  ...state,
  contractFindings: [...state.contractFindings, finding],
  items: [
   ...state.items,
   {
    id: makeId('item', state.items.length),
    threadId: contract.threadId,
    turnId: contract.turnId,
    itemType: 'status',
    summary: `Contract finding ${options.severity}: ${options.summary}`,
    createdAt,
    metadata: {
     contractPath: options.contractPath,
     nextAction: options.nextAction,
    },
   },
  ],
 });

 return finding;
}

export function completeHarnessThread(
 workspaceRoot: string,
 options: CompleteHarnessThreadOptions,
): void {
 const state = readHarnessState(workspaceRoot);
 const thread = getActiveThread(state);
 if (!thread) {
  return;
 }

 const turn = getActiveTurn(state, thread.id);
 const createdAt = nowIso();
 let nextState = state;

 if (turn) {
  nextState = replaceTurn(nextState, {
   ...turn,
   status: options.status === 'cancelled' ? 'cancelled' : 'complete',
   completedAt: createdAt,
   summary: options.summary,
  });
 }

 nextState = replaceThread(nextState, {
  ...thread,
  status: options.status,
  updatedAt: createdAt,
  currentTurnId: undefined,
 });

 nextState = {
  ...nextState,
  items: [
   ...nextState.items,
   {
    id: makeId('item', nextState.items.length),
    threadId: thread.id,
    turnId: turn?.id,
    itemType: 'summary',
    summary: options.summary,
    createdAt,
   },
  ],
  evidence: [
   ...nextState.evidence,
   {
    id: makeId('evidence', nextState.evidence.length),
    threadId: thread.id,
    turnId: turn?.id,
    evidenceType: 'completion',
    summary: options.summary,
    createdAt,
   },
  ],
 };

 writeHarnessState(workspaceRoot, nextState);
}

export function getHarnessStatusDisplay(workspaceRoot: string): string {
 const state = readHarnessState(workspaceRoot);
 const activeThread = getActiveThread(state);
 if (activeThread) {
  const activeTurn = getActiveTurn(state, activeThread.id);
  return `Harness ${activeThread.taskType} turn ${activeTurn?.sequence ?? 0} [active]`;
 }

 const latestThread = [...state.threads].reverse()[0];
 if (!latestThread) {
  return 'No harness';
 }

 return `Harness ${latestThread.status} (${state.threads.length} thread${state.threads.length === 1 ? '' : 's'})`;
}