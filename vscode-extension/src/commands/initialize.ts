import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { execShell } from '../utils/shell';
import * as path from 'path';
import * as fs from 'fs';

const REPO_URL = 'https://github.com/jnPiyush/AgentX.git';

/**
 * Register the AgentX: Initialize Project command.
 * Clones the AgentX repo, applies profile pruning, and copies framework files.
 */
export function registerInitializeCommand(
    context: vscode.ExtensionContext,
    agentx: AgentXContext
) {
    const cmd = vscode.commands.registerCommand('agentx.initialize', async () => {
        const root = agentx.workspaceRoot;
        if (!root) {
            vscode.window.showErrorMessage('AgentX: Open a workspace folder first.');
            return;
        }

        // Check if already initialized
        const initialized = await agentx.checkInitialized();
        if (initialized) {
            const overwrite = await vscode.window.showWarningMessage(
                'AgentX is already initialized in this workspace. Reinstall?',
                'Reinstall',
                'Cancel'
            );
            if (overwrite !== 'Reinstall') { return; }
        }

        // Pick profile
        const profile = await vscode.window.showQuickPick(
            [
                { label: 'full', description: 'Everything — all 41 skills, instructions, prompts (default)' },
                { label: 'minimal', description: 'Core only — agents, templates, CLI, docs' },
                { label: 'python', description: 'Core + Python, testing, data, API skills' },
                { label: 'dotnet', description: 'Core + C#, Blazor, Azure, SQL skills' },
                { label: 'react', description: 'Core + React, TypeScript, UI, design skills' },
            ],
            { placeHolder: 'Select an install profile', title: 'AgentX Profile' }
        );
        if (!profile) { return; }

        // Pick mode
        const mode = await vscode.window.showQuickPick(
            [
                { label: 'github', description: 'Full features: GitHub Actions, PRs, Projects' },
                { label: 'local', description: 'Filesystem-based issue tracking, no GitHub required' },
            ],
            { placeHolder: 'Select operating mode', title: 'AgentX Mode' }
        );
        if (!mode) { return; }

        // Save to settings
        const config = vscode.workspace.getConfiguration('agentx');
        await config.update('profile', profile.label, vscode.ConfigurationTarget.Workspace);
        await config.update('mode', mode.label, vscode.ConfigurationTarget.Workspace);

        // Run installation with progress
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'AgentX: Installing...',
                cancellable: false,
            },
            async (progress) => {
                try {
                    progress.report({ message: 'Cloning repository...' });
                    const tmpDir = path.join(root, '.agentx-install-tmp');

                    // Clone
                    await execShell(
                        `git clone --depth 1 --quiet "${REPO_URL}" "${tmpDir}"`,
                        root,
                        process.platform === 'win32' ? 'pwsh' : 'bash'
                    );

                    progress.report({ message: `Applying profile: ${profile.label}...`, increment: 30 });

                    // Remove .git and install scripts from clone
                    const rmTargets = [
                        path.join(tmpDir, '.git'),
                        path.join(tmpDir, 'install.ps1'),
                        path.join(tmpDir, 'install.sh'),
                        path.join(tmpDir, 'vscode-extension'),
                    ];
                    for (const target of rmTargets) {
                        if (fs.existsSync(target)) {
                            fs.rmSync(target, { recursive: true, force: true });
                        }
                    }

                    // Apply profile pruning
                    const pruneMap: Record<string, string[]> = {
                        full: [],
                        minimal: [
                            '.github/skills', '.github/instructions', '.github/prompts',
                            '.github/workflows', '.github/hooks', '.vscode', 'scripts',
                        ],
                        python: [
                            '.github/skills/cloud', '.github/skills/design',
                            '.github/skills/development/csharp', '.github/skills/development/blazor',
                            '.github/skills/development/react', '.github/skills/development/frontend-ui',
                            '.github/instructions/csharp.instructions.md',
                            '.github/instructions/blazor.instructions.md',
                            '.github/instructions/react.instructions.md',
                        ],
                        dotnet: [
                            '.github/skills/design',
                            '.github/skills/development/python', '.github/skills/development/react',
                            '.github/skills/development/frontend-ui',
                            '.github/instructions/python.instructions.md',
                            '.github/instructions/react.instructions.md',
                        ],
                        react: [
                            '.github/skills/cloud', '.github/skills/development/csharp',
                            '.github/skills/development/blazor', '.github/skills/development/python',
                            '.github/instructions/csharp.instructions.md',
                            '.github/instructions/blazor.instructions.md',
                            '.github/instructions/python.instructions.md',
                        ],
                    };

                    const toPrune = pruneMap[profile.label] || [];
                    for (const rel of toPrune) {
                        const target = path.join(tmpDir, rel);
                        if (fs.existsSync(target)) {
                            fs.rmSync(target, { recursive: true, force: true });
                        }
                    }

                    progress.report({ message: 'Copying files...', increment: 30 });

                    // Copy files from tmp to workspace root
                    copyDirRecursive(tmpDir, root);

                    // Clean up tmp
                    fs.rmSync(tmpDir, { recursive: true, force: true });

                    // Local mode setup
                    if (mode.label === 'local') {
                        const configDir = path.join(root, '.agentx');
                        const configFile = path.join(configDir, 'config.json');
                        const configData = {
                            mode: 'local',
                            version: '5.1.0',
                            profile: profile.label,
                            installedAt: new Date().toISOString(),
                        };
                        fs.writeFileSync(configFile, JSON.stringify(configData, null, 2));
                    }

                    progress.report({ message: 'Finalizing...', increment: 30 });

                    // Set context
                    vscode.commands.executeCommand('setContext', 'agentx.initialized', true);

                    vscode.window.showInformationMessage(
                        `AgentX initialized! Profile: ${profile.label}, Mode: ${mode.label}`
                    );

                    // Refresh tree views
                    vscode.commands.executeCommand('agentx.refresh');

                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err);
                    vscode.window.showErrorMessage(`AgentX initialization failed: ${message}`);
                }
            }
        );
    });

    // Profile selection command
    const profileCmd = vscode.commands.registerCommand('agentx.selectProfile', async () => {
        const profile = await vscode.window.showQuickPick(
            [
                { label: 'full', description: 'Everything — all 41 skills, instructions, prompts' },
                { label: 'minimal', description: 'Core only — agents, templates, CLI, docs' },
                { label: 'python', description: 'Core + Python, testing, data, API skills' },
                { label: 'dotnet', description: 'Core + C#, Blazor, Azure, SQL skills' },
                { label: 'react', description: 'Core + React, TypeScript, UI, design skills' },
            ],
            { placeHolder: 'Select an install profile' }
        );
        if (profile) {
            await vscode.workspace.getConfiguration('agentx')
                .update('profile', profile.label, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`AgentX profile set to: ${profile.label}`);
        }
    });

    context.subscriptions.push(cmd, profileCmd);
}

/** Recursively copy directory contents, merging into destination. */
function copyDirRecursive(src: string, dest: string): void {
    if (!fs.existsSync(src)) { return; }
    if (!fs.existsSync(dest)) { fs.mkdirSync(dest, { recursive: true }); }

    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            // Don't overwrite existing files (merge mode)
            if (!fs.existsSync(destPath)) {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}
