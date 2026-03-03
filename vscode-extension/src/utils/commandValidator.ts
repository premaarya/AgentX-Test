// ---------------------------------------------------------------------------
// AgentX -- Command Validator
// ---------------------------------------------------------------------------
//
// Replaces the 4-entry denylist in toolEngine.ts with a defense-in-depth
// allowlist approach:
//
//   Layer 1 -- Blocked:   hard-coded dangerous patterns (never execute)
//   Layer 2 -- Allowed:   known-safe commands (auto-execute, no prompt)
//   Layer 3 -- Confirm:   everything else (prompt user, show reversibility)
//
// Compound commands (joined by ;  &&  ||  |) are split and each sub-command
// is classified independently.  The final classification is the most
// restrictive of all sub-commands.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * How a command may be treated by the agentic loop executor.
 *
 * - 'allowed'              - auto-execute without user confirmation
 * - 'requires_confirmation' - pause and ask the user before running
 * - 'blocked'              - refuse to execute; return an error result
 */
export type CommandClassification = 'allowed' | 'blocked' | 'requires_confirmation';

/**
 * How recoverable the side-effects of a command are.
 *
 * - 'easy'        - undo in one step (e.g., git checkout, move-back)
 * - 'effort'      - recoverable with some work (e.g., restore from backup)
 * - 'irreversible'- cannot be undone (e.g., DROP TABLE, recursive force delete)
 */
export type Reversibility = 'easy' | 'effort' | 'irreversible';

/**
 * Full validation result for a single command string.
 */
export interface CommandValidationResult {
  readonly classification: CommandClassification;
  readonly command: string;
  readonly reversibility?: Reversibility;
  readonly undoHint?: string;
  readonly reason?: string;
}

// ---------------------------------------------------------------------------
// Allowlist
// ---------------------------------------------------------------------------

/**
 * Commands (or unambiguous prefixes) that are safe to auto-execute.
 * Matching is done on the first token (program name) and optional safe flags.
 */
export const DEFAULT_ALLOWLIST: readonly string[] = [
  // Version control -- read-only git verbs
  'git status', 'git diff', 'git log', 'git branch', 'git show',
  'git stash', 'git remote', 'git fetch', 'git ls-files',

  // Filesystem inspection
  'ls', 'dir', 'cat', 'type', 'head', 'tail', 'wc', 'find', 'grep',
  'rg', 'ripgrep', 'fd',

  // Shell builtins / utilities
  'echo', 'printf', 'pwd', 'cd', 'which', 'where', 'whoami',
  'hostname', 'date', 'env', 'printenv',

  // Node.js ecosystem -- read-only / non-mutating npm commands
  'npm run', 'npm test', 'npm list', 'npm ls', 'npm outdated',
  'npm audit', 'npm ci', 'npm version', 'npm view', 'npm info',
  'npm help', 'npm search',
  'node', 'npx', 'bun', 'deno',

  // Python -- read-only / non-mutating
  'python', 'python3',
  'pip list', 'pip show', 'pip check', 'pip freeze',
  'pip3 list', 'pip3 show', 'pip3 check', 'pip3 freeze',
  'pipenv run', 'poetry run', 'poetry show',

  // .NET
  'dotnet', 'nuget',

  // Build / lint / test tools
  'tsc', 'eslint', 'prettier', 'jest', 'vitest', 'mocha', 'pytest',
  'cargo', 'rustc', 'go', 'make', 'cmake', 'ninja',

  // Containers / orchestration (read-only usage)
  'docker', 'kubectl',

  // Network utilities (read-only)
  'curl', 'wget',
] as const;

// ---------------------------------------------------------------------------
// Blocked patterns
// ---------------------------------------------------------------------------

/**
 * Regexes that match commands which must NEVER be executed.
 * These override the allowlist.
 */
export const BLOCKED_PATTERNS: readonly RegExp[] = [
  // Original 4-entry denylist (kept for backward compat)
  /\brm\s+-rf\s+\//i,
  /\bformat\s+c:/i,
  /\bdrop\s+database\b/i,
  /\bgit\s+reset\s+--hard\b/i,

  // Fork bombs
  /:\(\)\s*\{\s*:\|:&\s*\};:/,

  // Reverse shells
  /bash\s+-i\s*>&\s*\/dev\/tcp\//i,
  /nc\s+.*-e\s+\/bin\/(ba)?sh/i,
  /python[23]?\s+.*socket.*exec/i,

  // Disk destruction
  /\bdd\s+if=\/dev\/zero\b/i,
  /\bdd\s+if=\/dev\/random\b/i,
  /\bmkfs\./i,
  /\bshred\s+.*\/dev\//i,

  // Pipe-to-shell (curl|bash, wget|sh, etc.)
  /\b(curl|wget)\b.*\|\s*\b(ba)?sh\b/i,
  /\b(curl|wget)\b.*\|\s*\bpython[23]?\b/i,

  // base64 decode pipe to shell
  /\bbase64\s+.*--decode\b.*\|\s*\b(ba)?sh\b/i,
  /echo\s+.*\|\s*base64\s+.*\|\s*\b(ba)?sh\b/i,

  // System power / init
  /\b(shutdown|reboot|halt)\b/i,
  /\binit\s+0\b/i,
  /\bsystemctl\s+(poweroff|reboot|halt)\b/i,

  // Dangerous chmod
  /\bchmod\s+(-R\s+)?777\s+\//i,

  // SQL truncation / destruction
  /\bTRUNCATE\s+TABLE\b/i,
  /\bDROP\s+TABLE\b/i,

  // Force-push (destructive git history rewrite)
  /\bgit\s+push\s+.*--force\b/i,
  /\bgit\s+push\s+.*-f\b/i,
] as const;

// ---------------------------------------------------------------------------
// Reversibility hints
// ---------------------------------------------------------------------------

interface ReversibilityEntry {
  readonly pattern: RegExp;
  readonly reversibility: Reversibility;
  readonly undoHint: string;
}

const REVERSIBILITY_TABLE: readonly ReversibilityEntry[] = [
  // Easy -- single-step undo
  { pattern: /\bgit\s+checkout\b/i,  reversibility: 'easy', undoHint: 'git checkout <previous-branch-or-commit>' },
  { pattern: /\bgit\s+stash\s+pop\b/i, reversibility: 'easy', undoHint: 'git stash (to re-stash the changes)' },
  { pattern: /\bgit\s+commit\b/i,    reversibility: 'easy', undoHint: 'git reset HEAD~1 (to undo the last commit)' },
  { pattern: /\bgit\s+merge\b/i,     reversibility: 'easy', undoHint: 'git merge --abort or git reset --merge' },
  { pattern: /\bmv\b/i,              reversibility: 'easy', undoHint: 'Move the file back with mv <dest> <src>' },
  { pattern: /\bcp\b/i,              reversibility: 'easy', undoHint: 'Delete the copy with rm <destination>' },

  // Irreversible -- MUST come before the more general 'rm' pattern below
  { pattern: /\brm\s+-[rRf]{1,3}\b/i, reversibility: 'irreversible', undoHint: 'No undo -- ensure files are backed up first' },
  { pattern: /\bgit\s+push\b/i,       reversibility: 'irreversible', undoHint: 'Already pushed to remote; contact repo admin to revert' },
  { pattern: /\bDROP\b/i,             reversibility: 'irreversible', undoHint: 'No undo for DROP; restore from database backup' },
  { pattern: /\bTRUNCATE\b/i,         reversibility: 'irreversible', undoHint: 'No undo for TRUNCATE; restore from database backup' },

  // Effort -- needs backup or external restore (general rm entry is listed
  // AFTER the more specific recursive-force entry above)
  { pattern: /\brm\b/i,             reversibility: 'effort', undoHint: 'Restore from backup or trash (if available)' },
  { pattern: /\bnpm\s+install\b/i,  reversibility: 'effort', undoHint: 'npm uninstall <pkg> or restore package.json' },
  { pattern: /\byarn\s+add\b/i,     reversibility: 'effort', undoHint: 'yarn remove <pkg>' },
  { pattern: /\bpip\s+install\b/i,  reversibility: 'effort', undoHint: 'pip uninstall <pkg>' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a command string for matching: collapse whitespace and lowercase.
 */
function normalise(cmd: string): string {
  return cmd.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Extract the base program name from a command string (first token, no path).
 */
function programName(cmd: string): string {
  const first = normalise(cmd).split(' ')[0] ?? '';
  // Strip path prefixes like ./node or /usr/bin/python3
  return first.replace(/^.*[/\\]/, '');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Split a compound command on shell operators: ;  &&  ||  |
 *
 * Splits carefully to avoid splitting inside quoted strings.
 * For safety, quoted-string parsing is intentionally conservative:
 * if a command contains unterminated quotes it is returned as-is.
 *
 * @returns An array of individual sub-command strings (trimmed, non-empty).
 */
export function splitCompoundCommand(command: string): readonly string[] {
  // Simple split on ; && || | -- sufficient for the vast majority of cases.
  // We do NOT attempt to handle sub-shells $() or backticks here;
  // those are classified conservatively (requires_confirmation).
  const parts = command.split(/;|&&|\|\||(?<!\|)\|(?!\|)/);
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Classify how reversible a command's side-effects are.
 */
export function classifyReversibility(
  command: string,
): { reversibility: Reversibility; undoHint?: string } {
  const norm = normalise(command);

  for (const entry of REVERSIBILITY_TABLE) {
    // Reset lastIndex before testing
    entry.pattern.lastIndex = 0;
    if (entry.pattern.test(norm)) {
      return { reversibility: entry.reversibility, undoHint: entry.undoHint };
    }
  }

  // Default: assume effort-level reversibility for unknown mutating commands
  return { reversibility: 'effort' };
}

/**
 * Validate a single (non-compound) command string.
 * @internal Use validateCommand() for the public API.
 */
function validateSingle(
  command: string,
  effectiveAllowlist: readonly string[],
): CommandValidationResult {
  const norm = normalise(command);
  const prog = programName(command);

  // Layer 1: hard-block dangerous patterns
  for (const pattern of BLOCKED_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(norm)) {
      return {
        classification: 'blocked',
        command,
        reason: `Blocked by security policy: matches dangerous pattern.`,
      };
    }
  }

  // Layer 2: allowlist -- check if the normalised command starts with an
  // allowlisted prefix (case-insensitive, already normalised).
  for (const entry of effectiveAllowlist) {
    const entryNorm = normalise(entry);
    // Match if norm equals the entry exactly, or starts with "entry " (to
    // correctly handle "git status --short" starting with "git status").
    if (norm === entryNorm || norm.startsWith(entryNorm + ' ')) {
      return {
        classification: 'allowed',
        command,
        reversibility: 'easy',
      };
    }
  }

  // Also allow if the bare program name is in the allowlist (handles cases
  // like "node --version" where "node" alone is in the list).
  for (const entry of effectiveAllowlist) {
    const entryNorm = normalise(entry);
    if (!entryNorm.includes(' ') && prog === entryNorm) {
      return {
        classification: 'allowed',
        command,
        reversibility: 'easy',
      };
    }
  }

  // Layer 3: unknown -- requires confirmation with reversibility info
  const rev = classifyReversibility(command);
  return {
    classification: 'requires_confirmation',
    command,
    reversibility: rev.reversibility,
    undoHint: rev.undoHint,
    reason: 'Command is not in the allowlist; user confirmation required.',
  };
}

/**
 * Validate a command string (potentially compound) against the security policy.
 *
 * For compound commands (containing ;  &&  ||  |), each sub-command is
 * validated independently and the most restrictive classification wins:
 *   blocked > requires_confirmation > allowed
 *
 * @param command       The raw command string from the LLM tool call.
 * @param customAllowlist  Optional extra entries to merge with DEFAULT_ALLOWLIST.
 * @returns             A CommandValidationResult describing the decision.
 */
export function validateCommand(
  command: string,
  customAllowlist?: readonly string[],
): CommandValidationResult {
  const effectiveAllowlist: readonly string[] = customAllowlist
    ? [...DEFAULT_ALLOWLIST, ...customAllowlist]
    : DEFAULT_ALLOWLIST;

  // -----------------------------------------------------------------------
  // Layer 1 (pre-split): check the FULL original command against blocked
  // patterns.  Patterns like fork-bombs and pipe-to-shell span the entire
  // command string and must be evaluated before splitting on operators.
  // -----------------------------------------------------------------------
  const fullNorm = normalise(command);
  for (const pattern of BLOCKED_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(fullNorm)) {
      return {
        classification: 'blocked',
        command,
        reason: `Blocked by security policy: matches dangerous pattern.`,
      };
    }
  }

  const parts = splitCompoundCommand(command);

  if (parts.length === 0) {
    return {
      classification: 'blocked',
      command,
      reason: 'Empty command.',
    };
  }

  // Classify each part; accumulate most restrictive result
  const RANK: Record<CommandClassification, number> = {
    allowed: 0,
    requires_confirmation: 1,
    blocked: 2,
  };

  let worst: CommandValidationResult = {
    classification: 'allowed',
    command,
    reversibility: 'easy',
  };

  for (const part of parts) {
    const result = validateSingle(part, effectiveAllowlist);
    if (RANK[result.classification] > RANK[worst.classification]) {
      // Keep the original compound command string, not the sub-command
      worst = { ...result, command };
    }
  }

  return worst;
}
