import { AgentXContext } from '../agentxContext';
import {
  buildAssessArgs,
  buildReconcileArgs,
  buildStartArgs,
  parseBoundedParallelRun,
  parseBoundedParallelRuns,
  renderBoundedParallelRunsText,
} from './parallelDeliveryEngine';
import type {
  BoundedParallelRun,
  ParallelAssessInput,
  ParallelReconcileInput,
  ParallelStartInput,
} from './parallel-deliveryTypes';

export type {
  BoundedParallelRun,
  ParallelAssessInput,
  ParallelReconcileInput,
  ParallelStartInput,
} from './parallel-deliveryTypes';

export { renderBoundedParallelRunsText };

export async function assessBoundedParallelDelivery(
  agentx: AgentXContext,
  input: ParallelAssessInput,
): Promise<BoundedParallelRun> {
  return parseBoundedParallelRun(await agentx.runCli('parallel', buildAssessArgs(input)));
}

export async function startBoundedParallelDelivery(
  agentx: AgentXContext,
  input: ParallelStartInput,
): Promise<BoundedParallelRun> {
  return parseBoundedParallelRun(await agentx.runCli('parallel', buildStartArgs(input)));
}

export async function listBoundedParallelRuns(agentx: AgentXContext): Promise<BoundedParallelRun[]> {
  return parseBoundedParallelRuns(await agentx.runCli('parallel', ['list', '--json']));
}

export async function getBoundedParallelRun(agentx: AgentXContext, parallelId: string): Promise<BoundedParallelRun> {
  return parseBoundedParallelRun(await agentx.runCli('parallel', ['get', '--id', parallelId, '--json']));
}

export async function reconcileBoundedParallelRun(
  agentx: AgentXContext,
  input: ParallelReconcileInput,
): Promise<BoundedParallelRun> {
  return parseBoundedParallelRun(await agentx.runCli('parallel', buildReconcileArgs(input)));
}