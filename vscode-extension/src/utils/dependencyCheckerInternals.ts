import { exec } from 'child_process';

import type { DependencyResult } from './dependencyCheckerTypes';

const MIN_POWERSHELL_VERSION = '7.4.0';

export function tryExec(command: string, timeoutMs = 10_000): Promise<string> {
  return new Promise((resolve) => {
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
    exec(command, { shell, timeout: timeoutMs }, (error, stdout) => {
      if (error) {
        resolve('');
        return;
      }
      resolve(stdout.trim());
    });
  });
}

export function parseVersion(raw: string): string {
  const match = raw.match(/(\d+\.\d+[\w.-]*)/);
  return match ? match[1] : raw.trim().substring(0, 30);
}

export function compareSemver(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => parseInt(part, 10) || 0);
  const rightParts = right.split('.').map((part) => parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index++) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue > rightValue) {
      return 1;
    }
    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

export async function checkNodeJs(): Promise<DependencyResult> {
  const raw = await tryExec('node --version');
  const found = raw.length > 0;
  const version = found ? parseVersion(raw) : '';

  let message = '';
  if (!found) {
    message = 'Node.js is not installed. Only needed for extension development (not required for end users).';
  } else {
    const major = parseInt(version.split('.')[0], 10);
    if (major < 18) {
      message = `Node.js ${version} found but v18+ is recommended for development.`;
    } else {
      message = `Node.js ${version} detected.`;
    }
  }

  return {
    name: 'Node.js',
    found,
    version,
    severity: 'optional',
    message,
    fixUrl: 'https://nodejs.org/',
    fixLabel: 'Download Node.js',
  };
}

export async function checkPowerShell(): Promise<DependencyResult> {
  const rawPwsh = await tryExec('pwsh -NoProfile -Command "$PSVersionTable.PSVersion.ToString()"');
  const hasPwsh = rawPwsh.length > 0;
  const pwshVersion = hasPwsh ? parseVersion(rawPwsh) : '';
  const meetsMinimum = hasPwsh && compareSemver(pwshVersion, MIN_POWERSHELL_VERSION) >= 0;

  let legacyVersion = '';
  if (process.platform === 'win32') {
    const rawLegacy = await tryExec('powershell.exe -NoProfile -Command "$PSVersionTable.PSVersion.ToString()"');
    legacyVersion = rawLegacy.length > 0 ? parseVersion(rawLegacy) : '';
  }

  let message = '';
  if (meetsMinimum) {
    message = `PowerShell ${pwshVersion} detected.`;
  } else if (hasPwsh) {
    message = `PowerShell ${pwshVersion} found, but AgentX requires PowerShell ${MIN_POWERSHELL_VERSION}+ (pwsh).`;
  } else if (legacyVersion) {
    message = `Windows PowerShell ${legacyVersion} found, but AgentX requires PowerShell ${MIN_POWERSHELL_VERSION}+ (pwsh).`;
  } else {
    message = `PowerShell ${MIN_POWERSHELL_VERSION}+ (pwsh) is required for AgentX PowerShell workflows.`;
  }

  return {
    name: 'PowerShell',
    found: meetsMinimum,
    version: hasPwsh ? pwshVersion : legacyVersion,
    severity: 'required',
    message,
    fixUrl: 'https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell',
    fixLabel: 'Install PowerShell 7.4+',
    fixCommand: process.platform === 'win32'
      ? 'winget install Microsoft.PowerShell'
      : process.platform === 'darwin'
        ? 'brew install powershell/tap/powershell'
        : 'sudo apt-get install -y powershell',
  };
}

export async function checkGit(): Promise<DependencyResult> {
  const raw = await tryExec('git --version');
  const found = raw.length > 0;
  const version = found ? parseVersion(raw) : '';

  return {
    name: 'Git',
    found,
    version,
    severity: 'required',
    message: found
      ? `Git ${version} detected.`
      : 'Git is not installed. Required for version control and hooks.',
    fixUrl: 'https://git-scm.com/downloads',
    fixLabel: 'Download Git',
    fixCommand: process.platform === 'win32'
      ? 'winget install Git.Git'
      : process.platform === 'darwin'
        ? 'brew install git'
        : 'sudo apt-get install -y git',
  };
}

export async function checkGitHubCli(): Promise<DependencyResult> {
  const raw = await tryExec('gh --version');
  const found = raw.length > 0;
  const version = found ? parseVersion(raw) : '';

  let authStatus = '';
  if (found) {
    authStatus = await tryExec('gh auth status 2>&1');
  }
  const authenticated = authStatus.includes('Logged in');

  let message = '';
  if (!found) {
    message = 'GitHub CLI not installed. Required for GitHub mode (issues, PRs, Projects).';
  } else if (!authenticated) {
    message = `GitHub CLI ${version} found but not authenticated. Run: gh auth login`;
  } else {
    message = `GitHub CLI ${version} detected and authenticated.`;
  }

  return {
    name: 'GitHub CLI (gh)',
    found,
    version,
    severity: 'recommended',
    message,
    fixUrl: 'https://cli.github.com/',
    fixLabel: 'Install GitHub CLI',
    fixCommand: process.platform === 'win32'
      ? 'winget install GitHub.cli'
      : process.platform === 'darwin'
        ? 'brew install gh'
        : 'sudo apt-get install -y gh',
  };
}

export async function checkAzureCli(): Promise<DependencyResult> {
  const raw = await tryExec('az --version');
  const found = raw.length > 0;
  const version = found ? parseVersion(raw) : '';

  let extensionInstalled = false;
  if (found) {
    const extRaw = await tryExec('az extension show --name azure-devops --output json');
    extensionInstalled = extRaw.length > 0;
  }

  let message = '';
  if (!found) {
    message = 'Azure CLI not installed. Required for Azure DevOps provider operations.';
  } else if (!extensionInstalled) {
    message = `Azure CLI ${version} found but azure-devops extension is missing. Run: az extension add --name azure-devops`;
  } else {
    message = `Azure CLI ${version} detected with azure-devops extension.`;
  }

  return {
    name: 'Azure CLI (az)',
    found: found && extensionInstalled,
    version,
    severity: 'recommended',
    message,
    fixUrl: 'https://learn.microsoft.com/cli/azure/install-azure-cli',
    fixLabel: 'Install Azure CLI',
    fixCommand: process.platform === 'win32'
      ? 'winget install Microsoft.AzureCLI'
      : process.platform === 'darwin'
        ? 'brew install azure-cli'
        : 'curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash',
  };
}
