import * as fs from 'fs';
import * as path from 'path';

export type HarnessThreadStatus = 'active' | 'complete' | 'cancelled' | 'blocked' | 'waiting-approval';
export type HarnessTurnStatus = 'active' | 'complete' | 'cancelled';
export type HarnessItemType = 'command' | 'iteration' | 'status' | 'summary' | 'approval';
export type HarnessEvidenceType = 'loop-output' | 'iteration-summary' | 'status-check' | 'completion';

export interface HarnessThread {
  readonly id: string;
  readonly title: string;
  readonly taskType: string;
  readonly status: HarnessThreadStatus;
  readonly issueNumber?: number | null;
  readonly planPath?: string;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly currentTurnId?: string;
}

export interface HarnessTurn {
  readonly id: string;
  readonly threadId: string;
  readonly sequence: number;
  readonly status: HarnessTurnStatus;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly summary?: string;
}

export interface HarnessItem {
  readonly id: string;
  readonly threadId: string;
  readonly turnId?: string;
  readonly itemType: HarnessItemType;
  readonly summary: string;
  readonly createdAt: string;
  readonly metadata?: Record<string, string | number | boolean | null>;
}

export interface HarnessEvidence {
  readonly id: string;
  readonly threadId: string;
  readonly turnId?: string;
  readonly evidenceType: HarnessEvidenceType;
  readonly summary: string;
  readonly createdAt: string;
}

export interface HarnessState {
  readonly version: 1;
  readonly threads: ReadonlyArray<HarnessThread>;
  readonly turns: ReadonlyArray<HarnessTurn>;
  readonly items: ReadonlyArray<HarnessItem>;
  readonly evidence: ReadonlyArray<HarnessEvidence>;
}

export interface StartHarnessThreadOptions {
  readonly taskType: string;
  readonly title: string;
  readonly prompt?: string;
  readonly completionCriteria?: string;
  readonly issueNumber?: number | null;
  readonly planPath?: string;
}

export interface CompleteHarnessThreadOptions {
  readonly status: Extract<HarnessThreadStatus, 'complete' | 'cancelled' | 'blocked'>;
  readonly summary: string;
}

const HARNESS_STATE_REL = '.agentx/state/harness-state.json';

function createDefaultState(): HarnessState {
  return {
    version: 1,
    threads: [],
    turns: [],
    items: [],
    evidence: [],
  };
}

function ensureStateDir(workspaceRoot: string): string {
  const dir = path.join(workspaceRoot, '.agentx', 'state');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getStatePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, HARNESS_STATE_REL);
}

function writeHarnessState(workspaceRoot: string, state: HarnessState): void {
  ensureStateDir(workspaceRoot);
  fs.writeFileSync(getStatePath(workspaceRoot), JSON.stringify(state, null, 2), 'utf-8');
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string, count: number): string {
  return `${prefix}-${Date.now()}-${count + 1}`;
}

function toPosixRelative(workspaceRoot: string, filePath: string): string {
  return path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
}

function findMarkdownFiles(dir: string, results: string[]): void {
  if (!fs.existsSync(dir)) {
    return;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findMarkdownFiles(fullPath, results);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
}

function getActiveThread(state: HarnessState): HarnessThread | undefined {
  return [...state.threads].reverse().find((thread) => thread.status === 'active');
}

function getActiveTurn(state: HarnessState, threadId: string): HarnessTurn | undefined {
  return [...state.turns].reverse().find((turn) => turn.threadId === threadId && turn.status === 'active');
}

function replaceThread(state: HarnessState, thread: HarnessThread): HarnessState {
  return {
    ...state,
    threads: state.threads.map((candidate) => candidate.id === thread.id ? thread : candidate),
  };
}

function replaceTurn(state: HarnessState, turn: HarnessTurn): HarnessState {
  return {
    ...state,
    turns: state.turns.map((candidate) => candidate.id === turn.id ? turn : candidate),
  };
}

export function readHarnessState(workspaceRoot: string): HarnessState {
  const filePath = getStatePath(workspaceRoot);
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
    };
  } catch {
    return createDefaultState();
  }
}

export function findDefaultExecutionPlanPath(workspaceRoot: string): string | undefined {
  const explicitPlansDir = path.join(workspaceRoot, 'docs', 'plans');
  const candidates: string[] = [];
  findMarkdownFiles(explicitPlansDir, candidates);

  if (candidates.length === 0) {
    const docsDir = path.join(workspaceRoot, 'docs');
    findMarkdownFiles(docsDir, candidates);
  }

  const planFile = candidates
    .map((candidate) => toPosixRelative(workspaceRoot, candidate))
    .sort()
    .find((candidate) => candidate.startsWith('docs/plans/') || /(^|\/)EXEC-PLAN.+\.md$/i.test(candidate));

  return planFile;
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