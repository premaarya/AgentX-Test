import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import { resolveWindowsShell } from '../utils/shell';

export const BRANCH = 'master';
export const ARCHIVE_URL = `https://github.com/jnPiyush/AgentX/archive/refs/heads/${BRANCH}.zip`;

export const ESSENTIAL_DIRS = ['.github/hooks', '.github/workflows', '.github/ISSUE_TEMPLATE'];

export const ESSENTIAL_FILES = [
  '.agentx/agentx.ps1',
  '.agentx/agentx-cli.ps1',
  '.agentx/agentx.sh',
  '.agentx/local-issue-manager.ps1',
  '.agentx/local-issue-manager.sh',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/agent-delegation.md',
  '.github/agentx-security.yml',
  '.github/CODEOWNERS',
  'AGENTS.md',
  'Skills.md',
  'docs/GUIDE.md',
  'docs/WORKFLOW.md',
];

export function copyDirRecursive(src: string, dest: string, overwrite = false): void {
  if (!fs.existsSync(src)) { return; }
  if (!fs.existsSync(dest)) { fs.mkdirSync(dest, { recursive: true }); }

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, overwrite);
    } else if (overwrite || !fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = (requestUrl: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }

      const transport = requestUrl.startsWith('https') ? https : http;
      transport.get(requestUrl, (response: {
        statusCode?: number;
        headers: { location?: string };
        pipe: (stream: fs.WriteStream) => void;
        resume: () => void;
      }) => {
        if (
          response.statusCode
          && response.statusCode >= 300
          && response.statusCode < 400
          && response.headers.location
        ) {
          response.resume();
          request(response.headers.location, redirectCount + 1);
          return;
        }

        if (response.statusCode && response.statusCode !== 200) {
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err: Error) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };

    request(url);
  });
}

export function mergeGitignore(root: string): void {
  const markerStart = '# --- AgentX (auto-generated, do not edit this block) ---';
  const markerEnd = '# --- /AgentX ---';
  const agentxEntries = [
    '# AgentX runtime (GitHub mode)',
    '.agentx/',
    '.github/hooks/',
    '.github/workflows/',
    '.github/ISSUE_TEMPLATE/',
  ];

  const gitignorePath = path.join(root, '.gitignore');
  let existing = '';
  if (fs.existsSync(gitignorePath)) {
    existing = fs.readFileSync(gitignorePath, 'utf-8');
  }

  if (existing.includes(markerStart)) {
    const before = existing.substring(0, existing.indexOf(markerStart));
    const afterIndex = existing.indexOf(markerEnd);
    const after = afterIndex >= 0
      ? existing.substring(afterIndex + markerEnd.length)
      : '';
    const block = [markerStart, ...agentxEntries, markerEnd].join('\n');
    fs.writeFileSync(gitignorePath, (before.trimEnd() + '\n\n' + block + after).trimStart(), 'utf-8');
    return;
  }

  const block = '\n\n' + [markerStart, ...agentxEntries, markerEnd].join('\n') + '\n';
  fs.writeFileSync(gitignorePath, existing.trimEnd() + block, 'utf-8');
}

export async function extractZip(zipPath: string, destDir: string): Promise<void> {
  fs.mkdirSync(destDir, { recursive: true });

  if (process.platform === 'win32') {
    const resolved = resolveWindowsShell();
    if (!resolved) {
      throw new Error(
        'PowerShell 7.4+ (pwsh) is required. Install it from '
        + 'https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell.',
      );
    }

    const { execShell: exec } = await import('../utils/shell');
    await exec(
      `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`,
      path.dirname(zipPath),
      'pwsh',
    );
    return;
  }

  const { execShell: exec } = await import('../utils/shell');
  await exec(
    `unzip -qo "${zipPath}" -d "${destDir}"`,
    path.dirname(zipPath),
    'bash',
  );
}