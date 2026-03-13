export interface PendingClarificationState {
  sessionId: string;
  agentName: string;
  prompt: string;
  humanPrompt?: string;
}

export interface AgentHandoff {
  readonly agent: string;
  readonly label: string;
  readonly prompt: string;
  readonly context: string;
  readonly send: boolean;
}

export interface AgentBoundaries {
  readonly canModify: string[];
  readonly cannotModify: string[];
}

export interface AgentDefinition {
  name?: string;
  description: string;
  model: string;
  visibility?: 'public' | 'internal';
  constraints?: string[];
  boundaries?: AgentBoundaries;
  fileName: string;
  handoffs?: AgentHandoff[];
  tools?: string[];
  agents?: string[];
}