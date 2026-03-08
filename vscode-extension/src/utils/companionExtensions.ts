import * as vscode from 'vscode';

/**
 * Companion extensions that AgentX recommends.
 * Checked on every activation; user is prompted to install if missing.
 */
const COMPANION_EXTENSIONS = [
  {
    id: 'ms-azuretools.vscode-azure-github-copilot',
    name: 'GitHub Copilot for Azure',
    reason: 'Provides 15+ operational Foundry sub-skills (create, deploy, trace, troubleshoot) that complement AgentX design skills.',
  },
];

/**
 * Check whether companion extensions are installed.
 * If any are missing, show a one-time prompt offering to install them.
 * The user can dismiss permanently via "Don't Ask Again".
 */
export async function checkCompanionExtensions(): Promise<void> {
  for (const ext of COMPANION_EXTENSIONS) {
    const installed = vscode.extensions.getExtension(ext.id);
    if (installed) {
      continue;
    }

    // Check if user previously dismissed this prompt
    const config = vscode.workspace.getConfiguration('agentx');
    const dismissed: string[] = config.get<string[]>('companionDismissed', []);
    if (dismissed.includes(ext.id)) {
      continue;
    }

    const install = 'Install';
    const later = 'Later';
    const never = "Don't Ask Again";

    const choice = await vscode.window.showInformationMessage(
      `AgentX recommends installing "${ext.name}" for full AI agent support. ${ext.reason}`,
      install,
      later,
      never,
    );

    if (choice === install) {
      await vscode.commands.executeCommand(
        'workbench.extensions.installExtension',
        ext.id,
      );
    } else if (choice === never) {
      const updated = [...dismissed, ext.id];
      await config.update('companionDismissed', updated, vscode.ConfigurationTarget.Global);
    }
    // 'Later' or dismissed notification -- do nothing, will prompt next activation
  }
}
