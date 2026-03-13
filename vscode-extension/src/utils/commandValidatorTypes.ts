export type CommandClassification = 'allowed' | 'blocked' | 'requires_confirmation';

export type Reversibility = 'easy' | 'effort' | 'irreversible';

export interface CommandValidationResult {
  readonly classification: CommandClassification;
  readonly command: string;
  readonly reversibility?: Reversibility;
  readonly undoHint?: string;
  readonly reason?: string;
}
