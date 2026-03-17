import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { promptWorkspaceRoot, readJsonWithComments } from './initializeInternals';
import { runCriticalPreCheck } from './setupWizard';

type AdapterMode = 'github' | 'ado';

interface AgentXConfig {
  readonly created?: string;
  readonly adapters?: Record<string, unknown>;
  readonly [key: string]: unknown;
}

async function promptGitHubSettings(root: string): Promise<{ repoSlug?: string; projectNum?: number } | undefined> {
  let detectedRepo: string | undefined;
  try {
    const { execShell: exec } = await import('../utils/shell');
    const shell = process.platform === 'win32' ? 'pwsh' as const : 'bash' as const;
    const remoteUrl = await exec('git remote get-url origin', root, shell);
    const match = remoteUrl.trim().match(/github\.com[:/]([^/]+\/[^/.]+)/);
    if (match) {
      detectedRepo = match[1].replace(/\.git$/, '');
    }
  } catch {
    // No git remote available.
  }

  let repoSlug: string | undefined;
  if (detectedRepo) {
    const useDetected = await vscode.window.showQuickPick(
      [
        { label: detectedRepo, description: 'Detected from git remote' },
        { label: 'Enter manually...', description: 'Type a different owner/repo' },
      ],
      { placeHolder: 'GitHub repository (owner/repo)', title: 'AgentX - GitHub Adapter' },
    );
    if (!useDetected) {
      return undefined;
    }
    if (useDetected.label === 'Enter manually...') {
      repoSlug = await vscode.window.showInputBox({
        prompt: 'GitHub repository (owner/repo)',
        placeHolder: 'myorg/myproject',
      });
    } else {
      repoSlug = useDetected.label;
    }
  } else {
    repoSlug = await vscode.window.showInputBox({
      prompt: 'GitHub repository (owner/repo)',
      placeHolder: 'myorg/myproject',
    });
  }

  if (!repoSlug) {
    return undefined;
  }

  const projectInput = await vscode.window.showInputBox({
    prompt: 'GitHub Project number (leave empty to skip)',
    placeHolder: '1',
    validateInput: (value) => {
      if (value && !/^\d+$/.test(value)) {
        return 'Must be a number';
      }
      return undefined;
    },
  });

  return {
    repoSlug,
    projectNum: projectInput ? parseInt(projectInput, 10) : undefined,
  };
}

async function promptAdoSettings(): Promise<{ organization?: string; project?: string } | undefined> {
  const organization = await vscode.window.showInputBox({
    prompt: 'Azure DevOps organization name (e.g. myorg)',
    placeHolder: 'myorg',
  });
  if (!organization) {
    return undefined;
  }

  const project = await vscode.window.showInputBox({
    prompt: 'Azure DevOps project name',
    placeHolder: 'MyProject',
  });
  if (!project) {
    return undefined;
  }

  return { organization, project };
}

export async function runAddRemoteAdapterCommand(agentx: AgentXContext): Promise<void> {
  const root = await promptWorkspaceRoot('AgentX - Add Remote Adapter');
  if (!root) {
    return;
  }

  const configFile = path.join(root, '.agentx', 'config.json');
  if (!fs.existsSync(configFile)) {
    vscode.window.showWarningMessage(
      'AgentX remote adapters require a local runtime. Run "AgentX: Initialize Local Runtime" first.',
    );
    return;
  }

  const modePick = await vscode.window.showQuickPick(
    [
      { label: 'github', description: 'GitHub Actions, PRs, Projects (via MCP)' },
      { label: 'ado', description: 'Azure DevOps work items, boards, pipelines (via MCP)' },
    ],
    { placeHolder: 'Select remote adapter to add', title: 'AgentX - Add Remote Adapter' },
  );
  if (!modePick) {
    return;
  }

  const mode = modePick.label as AdapterMode;
  const githubSettings = mode === 'github' ? await promptGitHubSettings(root) : undefined;
  if (mode === 'github' && !githubSettings) {
    return;
  }

  const adoSettings = mode === 'ado' ? await promptAdoSettings() : undefined;
  if (mode === 'ado' && !adoSettings) {
    return;
  }

  const vscodeDir = path.join(root, '.vscode');
  fs.mkdirSync(vscodeDir, { recursive: true });
  const mcpPath = path.join(vscodeDir, 'mcp.json');
  const mcpConfig = readJsonWithComments<{ servers?: Record<string, unknown> }>(mcpPath) ?? {};
  if (!mcpConfig.servers) {
    mcpConfig.servers = {};
  }
  mcpConfig.servers[mode] = {
    type: 'http',
    url: 'https://api.githubcopilot.com/mcp/',
  };
  fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2));

  const existingConfig = readJsonWithComments<AgentXConfig>(configFile) ?? {};
  const adapters = { ...(existingConfig.adapters as Record<string, unknown> | undefined) };
  adapters[mode] = mode === 'github'
    ? {
        repo: githubSettings?.repoSlug ?? null,
        project: githubSettings?.projectNum ?? null,
      }
    : {
        organization: adoSettings?.organization ?? null,
        project: adoSettings?.project ?? null,
      };

  const nextConfig: Record<string, unknown> = {
    ...existingConfig,
    provider: 'local',
    integration: 'local',
    mode: 'local',
    adapters,
    created: existingConfig.created ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (mode === 'github') {
    nextConfig.repo = githubSettings?.repoSlug ?? null;
    nextConfig.project = githubSettings?.projectNum ?? null;
  } else {
    nextConfig.organization = adoSettings?.organization ?? null;
    nextConfig.project = adoSettings?.project ?? null;
  }

  fs.writeFileSync(configFile, JSON.stringify(nextConfig, null, 2));

  agentx.invalidateCache();
  vscode.commands.executeCommand('setContext', 'agentx.initialized', true);
  vscode.commands.executeCommand('setContext', 'agentx.githubConnected', agentx.githubConnected);
  vscode.commands.executeCommand('setContext', 'agentx.adoConnected', agentx.adoConnected);

  const preCheck = await runCriticalPreCheck(agentx, true);
  if (!preCheck.passed) {
    vscode.window.showWarningMessage(
      `AgentX: ${mode === 'github' ? 'GitHub' : 'Azure DevOps'} adapter added and local runtime remains active, but some required dependencies still need attention.`,
    );
    return;
  }

  vscode.window.showInformationMessage(
    `AgentX: ${mode === 'github' ? 'GitHub' : 'Azure DevOps'} adapter added. Local runtime remains active.`,
  );
  vscode.commands.executeCommand('agentx.refresh');
}