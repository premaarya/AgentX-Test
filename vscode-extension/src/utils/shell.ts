import { exec, spawn } from 'child_process';
import {
 buildShellArgs,
 compareSemver,
 detectPwshVersion,
 flushBuffer,
 getMissingPwshError,
 MIN_POWERSHELL_VERSION,
 resolveShellPath,
} from './shellInternals';

const DEFAULT_EXEC_TIMEOUT_MS = 120_000;

/**
 * Cached result of PowerShell availability check.
 * null = not yet checked, string = resolved shell path.
 */
let _resolvedPwsh: string | null = null;

/**
 * Detect a supported PowerShell executable on the current system.
 *
 * AgentX requires `pwsh` 7.4+ on Windows. Returns an empty string when no
 * supported `pwsh` runtime is found.
 */
export function resolveWindowsShell(): string {
  if (_resolvedPwsh !== null) { return _resolvedPwsh; }

  // Try pwsh (PowerShell 7+ cross-platform)
  try {
    const version = detectPwshVersion();
    if (compareSemver(version, MIN_POWERSHELL_VERSION) >= 0) {
      _resolvedPwsh = 'pwsh';
      return _resolvedPwsh;
    }
  } catch { /* pwsh not available */ }

  _resolvedPwsh = '';
  return _resolvedPwsh;
}

/**
 * Clear the cached shell resolution (useful for tests).
 */
export function resetShellCache(): void {
  _resolvedPwsh = null;
}

/**
 * Execute a shell command and return stdout.
 *
 * On Windows the `shell` parameter accepts `'pwsh'` (default) and requires
 * PowerShell 7.4+ to be installed. Pass `'bash'` for Unix shells.
 */
export function execShell(
 command: string,
 cwd: string,
 shell: 'pwsh' | 'bash' = 'pwsh',
 envOverrides?: NodeJS.ProcessEnv,
): Promise<string> {
 return new Promise((resolve, reject) => {
 let shellPath: string;

 if (shell === 'bash') {
   shellPath = resolveShellPath(shell, '');
 } else {
   // Resolve to a supported PowerShell runtime (pwsh 7.4+)
   const resolved = resolveWindowsShell();
   if (!resolved) {
     reject(getMissingPwshError());
     return;
   }
   shellPath = resolveShellPath(shell, resolved);
 }

 const options = {
 cwd,
 shell: shellPath,
 maxBuffer: 1024 * 1024,
 timeout: DEFAULT_EXEC_TIMEOUT_MS,
 env: { ...process.env, ...envOverrides, NO_COLOR: '1' },
 };

 exec(command, options, (error, stdout, stderr) => {
 if (error) {
 reject(new Error(`Command failed: ${error.message}\n${stderr}`));
 return;
 }
 resolve(stdout.trim());
 });
 });
}

/**
 * Execute a shell command and stream stdout/stderr line-by-line while also
 * returning the final stdout payload.
 */
export function execShellStreaming(
 command: string,
 cwd: string,
 shell: 'pwsh' | 'bash' = 'pwsh',
 onLine?: (line: string, source: 'stdout' | 'stderr') => void,
 envOverrides?: NodeJS.ProcessEnv,
): Promise<string> {
 return new Promise((resolve, reject) => {
  let shellPath: string;

  if (shell === 'bash') {
   shellPath = resolveShellPath(shell, '');
  } else {
   const resolved = resolveWindowsShell();
   if (!resolved) {
    reject(getMissingPwshError());
    return;
   }
   shellPath = resolveShellPath(shell, resolved);
  }

  const args = buildShellArgs(shell, command);

  const child = spawn(shellPath, args, {
   cwd,
    env: { ...process.env, ...envOverrides, NO_COLOR: '1' },
   stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  let stdoutBuffer = '';
  let stderrBuffer = '';

  child.stdout.on('data', (chunk: Buffer | string) => {
   const text = chunk.toString();
   stdoutChunks.push(text);
   stdoutBuffer += text;
   stdoutBuffer = flushBuffer(stdoutBuffer, 'stdout', onLine);
  });

  child.stderr.on('data', (chunk: Buffer | string) => {
   const text = chunk.toString();
   stderrChunks.push(text);
   stderrBuffer += text;
   stderrBuffer = flushBuffer(stderrBuffer, 'stderr', onLine);
  });

  child.on('error', (error) => {
   reject(new Error(`Command failed: ${error.message}`));
  });

  child.on('close', (code) => {
   if (stdoutBuffer.trim().length > 0) {
    onLine?.(stdoutBuffer.trim(), 'stdout');
   }
   if (stderrBuffer.trim().length > 0) {
    onLine?.(stderrBuffer.trim(), 'stderr');
   }

  const stdout = stdoutChunks.join('').replace(/\r/g, '');
  const stderr = stderrChunks.join('').replace(/\r/g, '');
   if (code && code !== 0) {
    reject(new Error(`Command failed: exit code ${code}\n${stderr}`));
    return;
   }
   resolve(stdout.trim());
  });
 });
}
