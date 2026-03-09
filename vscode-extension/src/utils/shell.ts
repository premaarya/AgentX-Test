import { exec, execSync, spawn } from 'child_process';

/**
 * Cached result of PowerShell availability check.
 * null = not yet checked, string = resolved shell path.
 */
let _resolvedPwsh: string | null = null;

/**
 * Detect the best available PowerShell executable on the current system.
 *
 * Checks `pwsh` (PowerShell 7+) first, then falls back to `powershell.exe`
 * (Windows PowerShell 5.1) on Windows. Returns an empty string when neither
 * is found.
 */
export function resolveWindowsShell(): string {
  if (_resolvedPwsh !== null) { return _resolvedPwsh; }

  // Try pwsh (PowerShell 7+ cross-platform)
  try {
    execSync('pwsh -NoProfile -Command "exit 0"', { stdio: 'ignore', timeout: 5_000 });
    _resolvedPwsh = 'pwsh';
    return _resolvedPwsh;
  } catch { /* pwsh not available */ }

  // On Windows, fall back to built-in powershell.exe (v5.1)
  if (process.platform === 'win32') {
    try {
      execSync('powershell.exe -NoProfile -Command "exit 0"', { stdio: 'ignore', timeout: 5_000 });
      _resolvedPwsh = 'powershell.exe';
      return _resolvedPwsh;
    } catch { /* powershell.exe not available */ }
  }

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
 * On Windows the `shell` parameter accepts `'pwsh'` (default) which will
 * automatically resolve to `pwsh` or `powershell.exe` depending on what
 * is available. Pass `'bash'` for Unix shells.
 */
export function execShell(
 command: string,
 cwd: string,
 shell: 'pwsh' | 'bash' = 'pwsh'
): Promise<string> {
 return new Promise((resolve, reject) => {
 let shellPath: string;

 if (shell === 'bash') {
   shellPath = '/bin/bash';
 } else {
   // Resolve to best available PowerShell (pwsh > powershell.exe)
   const resolved = resolveWindowsShell();
   if (!resolved) {
     reject(new Error(
       'PowerShell is not installed. Install PowerShell 7+ (pwsh) from '
       + 'https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell '
       + 'or ensure Windows PowerShell (powershell.exe) is available.'
     ));
     return;
   }
   shellPath = resolved;
 }

 const options = {
 cwd,
 shell: shellPath,
 maxBuffer: 1024 * 1024,
 timeout: 30_000,
 env: { ...process.env, NO_COLOR: '1' },
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
   shellPath = '/bin/bash';
  } else {
   const resolved = resolveWindowsShell();
   if (!resolved) {
    reject(new Error(
      'PowerShell is not installed. Install PowerShell 7+ (pwsh) from '
      + 'https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell '
      + 'or ensure Windows PowerShell (powershell.exe) is available.'
    ));
    return;
   }
   shellPath = resolved;
  }

  const args = shell === 'bash'
   ? ['-lc', command]
   : ['-NoProfile', '-Command', command];

  const child = spawn(shellPath, args, {
   cwd,
    env: { ...process.env, ...envOverrides, NO_COLOR: '1' },
   stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  let stdoutBuffer = '';
  let stderrBuffer = '';

  const flushBuffer = (buffer: string, source: 'stdout' | 'stderr'): string => {
   const normalized = buffer.replace(/\r/g, '');
   const lines = normalized.split('\n');
   const remainder = lines.pop() ?? '';
   for (const line of lines) {
    if (line.length > 0) {
      onLine?.(line, source);
    }
   }
   return remainder;
  };

  child.stdout.on('data', (chunk: Buffer | string) => {
   const text = chunk.toString();
   stdoutChunks.push(text);
   stdoutBuffer += text;
   stdoutBuffer = flushBuffer(stdoutBuffer, 'stdout');
  });

  child.stderr.on('data', (chunk: Buffer | string) => {
   const text = chunk.toString();
   stderrChunks.push(text);
   stderrBuffer += text;
   stderrBuffer = flushBuffer(stderrBuffer, 'stderr');
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
