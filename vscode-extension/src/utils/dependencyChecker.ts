import {
  checkAzureCli,
  checkGit,
  checkGitHubCli,
  checkNodeJs,
  checkPowerShell,
} from './dependencyCheckerInternals';
import type {
  EnvironmentReport,
  IntegrationProvider,
} from './dependencyCheckerTypes';

export type {
  DependencyResult,
  DependencySeverity,
  EnvironmentReport,
  IntegrationProvider,
} from './dependencyCheckerTypes';

/**
 * Run all dependency checks and return a full environment report.
 *
 * @param integrations - Provider with githubConnected / adoConnected flags.
 *   When omitted, defaults to no integrations (local-only behavior).
 */
export async function checkAllDependencies(
  integrations?: IntegrationProvider,
): Promise<EnvironmentReport> {
  const github = integrations?.githubConnected ?? false;
  const ado = integrations?.adoConnected ?? false;
  // Run independent checks in parallel
  // NOTE: GitHub Copilot is bundled into VS Code 1.96+. No runtime
  // check is needed. The extension.ts activation guard
  // (vscode.chat?.createChatParticipant) provides graceful
  // degradation on older VS Code versions.
  const checks = await Promise.all([
    checkNodeJs(),
    checkPowerShell(),
    checkGit(),
    checkGitHubCli(),
    checkAzureCli(),
  ]);

  // Adjust severity based on active integrations
  const results = checks.map(r => {
    // GitHub CLI is required when GitHub integration is configured
    if (r.name === 'GitHub CLI (gh)') {
      r.severity = github ? 'required' : 'optional';
    }
    if (r.name === 'Azure CLI (az)') {
      r.severity = ado ? 'required' : 'optional';
    }
    // PowerShell on non-Windows without any integration is optional (bash works)
    if (r.name === 'PowerShell' && process.platform !== 'win32' && !github && !ado) {
      r.severity = 'recommended';
    }
    return r;
  });

  const criticalCount = results.filter(r => r.severity === 'required' && !r.found).length;
  const warningCount = results.filter(r => r.severity === 'recommended' && !r.found).length;

  return {
    results,
    healthy: criticalCount === 0,
    criticalCount,
    warningCount,
    timestamp: new Date().toISOString(),
  };
}
