/**
 * AgentX Workflow Enforcer - VS Code Extension
 * 
 * Enforces the issue-first workflow by:
 * 1. Intercepting file save operations
 * 2. Checking for active GitHub Issues with status:in-progress
 * 3. Blocking saves if no issue is claimed
 * 
 * Part of the AgentX framework for AI agent guidelines.
 */

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

interface GitHubIssue {
    number: number;
    title: string;
    labels: string[];
    state: string;
    created_at: string;
}

interface WorkflowState {
    enabled: boolean;
    activeIssue: GitHubIssue | null;
    lastCheck: Date | null;
    repoPath: string | null;
}

let state: WorkflowState = {
    enabled: true,
    activeIssue: null,
    lastCheck: null,
    repoPath: null
};

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('AgentX Workflow Enforcer is now active');

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'agentx.checkStatus';
    context.subscriptions.push(statusBarItem);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('agentx.createIssue', createIssue),
        vscode.commands.registerCommand('agentx.claimIssue', claimIssue),
        vscode.commands.registerCommand('agentx.checkStatus', checkStatus),
        vscode.commands.registerCommand('agentx.toggleEnforcement', toggleEnforcement)
    );

    // Register save interceptor
    context.subscriptions.push(
        vscode.workspace.onWillSaveTextDocument(onWillSaveDocument)
    );

    // Register file creation interceptor
    context.subscriptions.push(
        vscode.workspace.onWillCreateFiles(onWillCreateFiles)
    );

    // Initial status check
    refreshStatus();

    // Refresh status periodically (every 2 minutes)
    const refreshInterval = setInterval(refreshStatus, 120000);
    context.subscriptions.push({ dispose: () => clearInterval(refreshInterval) });
}

export function deactivate() {
    statusBarItem?.dispose();
}

/**
 * Intercepts file save operations
 */
async function onWillSaveDocument(event: vscode.TextDocumentWillSaveEvent) {
    const config = vscode.workspace.getConfiguration('agentx');
    
    if (!config.get<boolean>('enabled', true)) {
        return;
    }

    if (!config.get<boolean>('blockOnSave', true)) {
        return;
    }

    // Check if file should be excluded
    const excludePatterns = config.get<string[]>('excludePatterns', []);
    const filePath = event.document.uri.fsPath;
    
    if (shouldExcludeFile(filePath, excludePatterns)) {
        return;
    }

    // Check if we have an active issue
    if (!state.activeIssue) {
        await refreshStatus();
    }

    if (!state.activeIssue) {
        const showWarningOnly = config.get<boolean>('showWarningOnly', false);
        
        if (showWarningOnly) {
            vscode.window.showWarningMessage(
                '⚠️ AgentX: No GitHub Issue claimed. Remember to create and claim an issue!',
                'Create Issue',
                'Claim Issue'
            ).then(handleDialogResponse);
        } else {
            // Block the save
            event.waitUntil(
                showBlockingDialog(event.document.uri)
            );
        }
    }
}

/**
 * Intercepts file creation operations
 */
async function onWillCreateFiles(event: vscode.FileWillCreateEvent) {
    const config = vscode.workspace.getConfiguration('agentx');
    
    if (!config.get<boolean>('enabled', true)) {
        return;
    }

    // Check if we have an active issue
    if (!state.activeIssue) {
        await refreshStatus();
    }

    if (!state.activeIssue) {
        const showWarningOnly = config.get<boolean>('showWarningOnly', false);
        
        if (!showWarningOnly) {
            event.waitUntil(
                Promise.reject(new Error(
                    'AgentX: Cannot create files without an active GitHub Issue. ' +
                    'Use "AgentX: Create GitHub Issue" command first.'
                ))
            );
        }
    }
}

/**
 * Shows a blocking dialog that prevents save until action is taken
 */
async function showBlockingDialog(uri: vscode.Uri): Promise<vscode.TextEdit[]> {
    const response = await vscode.window.showErrorMessage(
        '⛔ AgentX Workflow Violation: No GitHub Issue is claimed!\n\n' +
        'You must create and claim a GitHub Issue before modifying files.',
        { modal: true },
        'Create Issue',
        'Claim Existing Issue',
        'Skip Once (Violation Logged)'
    );

    await handleDialogResponse(response);

    if (response === 'Skip Once (Violation Logged)') {
        logViolation(uri);
        return []; // Allow save
    }

    // Throw to prevent save
    throw new Error('Save cancelled - no active GitHub Issue');
}

/**
 * Handles dialog button responses
 */
async function handleDialogResponse(response: string | undefined) {
    switch (response) {
        case 'Create Issue':
            await createIssue();
            break;
        case 'Claim Issue':
        case 'Claim Existing Issue':
            await claimIssue();
            break;
    }
}

/**
 * Creates a new GitHub Issue
 */
async function createIssue() {
    const title = await vscode.window.showInputBox({
        prompt: 'Issue title',
        placeHolder: '[Type] Brief description'
    });

    if (!title) {
        return;
    }

    const description = await vscode.window.showInputBox({
        prompt: 'Issue description (optional)',
        placeHolder: 'What needs to be done'
    });

    try {
        const body = `## Description\n${description || 'Task description'}\n\n## Acceptance Criteria\n- [ ] Criterion 1`;
        const cmd = `gh issue create --title "${title}" --body "${body}" --label "type:task,status:ready"`;
        
        const { stdout } = await execAsync(cmd, { cwd: state.repoPath || undefined });
        
        // Extract issue number from URL
        const match = stdout.match(/issues\/(\d+)/);
        if (match) {
            const issueNumber = match[1];
            
            // Offer to claim it
            const claim = await vscode.window.showInformationMessage(
                `✅ Issue #${issueNumber} created. Claim it now?`,
                'Yes, Claim It',
                'No'
            );

            if (claim === 'Yes, Claim It') {
                await claimIssueByNumber(parseInt(issueNumber));
            }
        }

        await refreshStatus();

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to create issue: ${error.message}`);
    }
}

/**
 * Shows a picker to claim an existing issue
 */
async function claimIssue() {
    try {
        // Get ready issues
        const { stdout } = await execAsync(
            'gh issue list --label "status:ready" --state open --json number,title --limit 20',
            { cwd: state.repoPath || undefined }
        );

        const issues: { number: number; title: string }[] = JSON.parse(stdout);

        if (issues.length === 0) {
            const create = await vscode.window.showWarningMessage(
                'No ready issues found. Create a new one?',
                'Create Issue',
                'Cancel'
            );
            
            if (create === 'Create Issue') {
                await createIssue();
            }
            return;
        }

        const selected = await vscode.window.showQuickPick(
            issues.map(i => ({
                label: `#${i.number}`,
                description: i.title,
                issue: i
            })),
            { placeHolder: 'Select an issue to claim' }
        );

        if (selected) {
            await claimIssueByNumber(selected.issue.number);
        }

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to list issues: ${error.message}`);
    }
}

/**
 * Claims a specific issue by number
 */
async function claimIssueByNumber(issueNumber: number) {
    try {
        await execAsync(
            `gh issue edit ${issueNumber} --add-label "status:in-progress" --remove-label "status:ready"`,
            { cwd: state.repoPath || undefined }
        );

        vscode.window.showInformationMessage(`✅ Issue #${issueNumber} claimed!`);
        await refreshStatus();

    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to claim issue: ${error.message}`);
    }
}

/**
 * Checks and displays current workflow status
 */
async function checkStatus() {
    await refreshStatus();

    if (state.activeIssue) {
        vscode.window.showInformationMessage(
            `✅ Active Issue: #${state.activeIssue.number} - ${state.activeIssue.title}`
        );
    } else {
        const response = await vscode.window.showWarningMessage(
            '⚠️ No active issue claimed. Create or claim one to proceed.',
            'Create Issue',
            'Claim Issue'
        );
        await handleDialogResponse(response);
    }
}

/**
 * Toggles enforcement on/off
 */
async function toggleEnforcement() {
    const config = vscode.workspace.getConfiguration('agentx');
    const current = config.get<boolean>('enabled', true);
    
    await config.update('enabled', !current, vscode.ConfigurationTarget.Workspace);
    
    state.enabled = !current;
    updateStatusBar();

    vscode.window.showInformationMessage(
        `AgentX Workflow Enforcement: ${!current ? 'ENABLED' : 'DISABLED'}`
    );
}

/**
 * Refreshes the workflow status by checking GitHub
 */
async function refreshStatus() {
    try {
        // Get repo path
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        state.repoPath = workspaceFolder.uri.fsPath;

        // Check for in-progress issues assigned to current user
        const { stdout } = await execAsync(
            'gh issue list --label "status:in-progress" --assignee @me --state open --json number,title,labels --limit 1',
            { cwd: state.repoPath }
        );

        const issues = JSON.parse(stdout);
        
        if (issues.length > 0) {
            state.activeIssue = {
                number: issues[0].number,
                title: issues[0].title,
                labels: issues[0].labels?.map((l: any) => l.name) || [],
                state: 'open',
                created_at: ''
            };
        } else {
            state.activeIssue = null;
        }

        state.lastCheck = new Date();
        updateStatusBar();

    } catch (error: any) {
        console.error('Failed to refresh status:', error);
        // Don't block if gh CLI fails
        state.activeIssue = null;
        updateStatusBar();
    }
}

/**
 * Updates the status bar item
 */
function updateStatusBar() {
    const config = vscode.workspace.getConfiguration('agentx');
    const enabled = config.get<boolean>('enabled', true);

    if (!enabled) {
        statusBarItem.text = '$(debug-pause) AgentX: OFF';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.tooltip = 'Workflow enforcement disabled. Click to check status.';
    } else if (state.activeIssue) {
        statusBarItem.text = `$(check) AgentX: #${state.activeIssue.number}`;
        statusBarItem.backgroundColor = undefined;
        statusBarItem.tooltip = `Active: ${state.activeIssue.title}\nClick for details.`;
    } else {
        statusBarItem.text = '$(alert) AgentX: No Issue';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        statusBarItem.tooltip = 'No active issue! Click to create or claim one.';
    }

    statusBarItem.show();
}

/**
 * Checks if a file should be excluded from enforcement
 */
function shouldExcludeFile(filePath: string, patterns: string[]): boolean {
    const relativePath = vscode.workspace.asRelativePath(filePath);
    
    for (const pattern of patterns) {
        if (matchGlob(relativePath, pattern)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Simple glob matching
 */
function matchGlob(filePath: string, pattern: string): boolean {
    const regexPattern = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');
    
    return new RegExp(`^${regexPattern}$`).test(filePath);
}

/**
 * Logs a workflow violation
 */
function logViolation(uri: vscode.Uri) {
    console.warn(`AgentX Workflow Violation: File saved without active issue: ${uri.fsPath}`);
    
    // Could also write to a file or send telemetry
    const outputChannel = vscode.window.createOutputChannel('AgentX Violations');
    outputChannel.appendLine(`${new Date().toISOString()} - VIOLATION: ${uri.fsPath}`);
}
