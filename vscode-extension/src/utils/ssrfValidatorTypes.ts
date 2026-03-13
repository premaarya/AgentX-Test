export interface SsrfValidationResult {
  readonly allowed: boolean;
  readonly url: string;
  readonly reason?: string;
}
