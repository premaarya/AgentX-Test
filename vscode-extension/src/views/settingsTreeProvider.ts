import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Setting definitions -- the single source of truth for the sidebar panel.
// Each group maps to a VS Code configuration section (e.g. agentx.loop.*).
// ---------------------------------------------------------------------------

interface SettingDef {
  /** VS Code setting key (fully qualified). */
  readonly key: string;
  /** Human-readable label shown in the tree. */
  readonly label: string;
  /** Tooltip / description. */
  readonly tooltip: string;
  /** Default value (must match package.json). */
  readonly defaultValue: number;
}

interface SettingGroup {
  readonly label: string;
  readonly icon: string;
  readonly settings: readonly SettingDef[];
}

const SETTING_GROUPS: readonly SettingGroup[] = [
  {
    label: 'Agentic Loop',
    icon: 'symbol-event',
    settings: [
      {
        key: 'agentx.loop.maxIterations',
        label: 'Max Iterations',
        tooltip: 'Maximum tool-call cycles for the main agentic loop',
        defaultValue: 20,
      },
      {
        key: 'agentx.loop.tokenBudget',
        label: 'Token Budget',
        tooltip: 'Token budget for the main agentic loop session',
        defaultValue: 100_000,
      },
    ],
  },
  {
    label: 'Self-Review',
    icon: 'checklist',
    settings: [
      {
        key: 'agentx.selfReview.maxIterations',
        label: 'Max Review Rounds',
        tooltip: 'Maximum review-fix-re-review rounds',
        defaultValue: 15,
      },
      {
        key: 'agentx.selfReview.reviewerMaxIterations',
        label: 'Reviewer Max Iterations',
        tooltip: 'Maximum internal iterations for the reviewer sub-agent',
        defaultValue: 8,
      },
    ],
  },
  {
    label: 'Clarification',
    icon: 'comment-discussion',
    settings: [
      {
        key: 'agentx.clarification.maxIterations',
        label: 'Max Q&A Rounds',
        tooltip: 'Maximum question-answer rounds between agents',
        defaultValue: 6,
      },
      {
        key: 'agentx.clarification.responderMaxIterations',
        label: 'Responder Max Iterations',
        tooltip: 'Maximum internal iterations for the responding sub-agent',
        defaultValue: 5,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Tree items
// ---------------------------------------------------------------------------

type SettingsNode = SettingGroupItem | SettingValueItem;

class SettingGroupItem extends vscode.TreeItem {
  constructor(readonly group: SettingGroup) {
    super(group.label, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon(group.icon);
    this.contextValue = 'settingGroup';
  }
}

class SettingValueItem extends vscode.TreeItem {
  constructor(readonly def: SettingDef, currentValue: number) {
    super(def.label, vscode.TreeItemCollapsibleState.None);
    this.description = String(currentValue);
    this.tooltip = `${def.tooltip} (default: ${def.defaultValue})`;
    this.iconPath = new vscode.ThemeIcon('symbol-number');
    this.contextValue = 'settingValue';
    this.command = {
      command: 'agentx.editSetting',
      title: 'Edit Setting',
      arguments: [def],
    };
  }
}

// ---------------------------------------------------------------------------
// Tree data provider
// ---------------------------------------------------------------------------

/**
 * Tree data provider for the Settings sidebar view.
 * Shows agentic loop, self-review, and clarification iteration settings
 * grouped by category. Click a value to edit it inline.
 */
export class SettingsTreeProvider implements vscode.TreeDataProvider<SettingsNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SettingsNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SettingsNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SettingsNode): SettingsNode[] {
    if (!element) {
      // Root -- return groups
      return SETTING_GROUPS.map(g => new SettingGroupItem(g));
    }
    if (element instanceof SettingGroupItem) {
      return element.group.settings.map(s => {
        const current = this.readSetting(s);
        return new SettingValueItem(s, current);
      });
    }
    return [];
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private readSetting(def: SettingDef): number {
    // Split "agentx.loop.maxIterations" -> section "agentx.loop", key "maxIterations"
    const lastDot = def.key.lastIndexOf('.');
    const section = def.key.slice(0, lastDot);
    const key = def.key.slice(lastDot + 1);
    return vscode.workspace.getConfiguration(section).get<number>(key, def.defaultValue);
  }
}

// ---------------------------------------------------------------------------
// Edit command -- inline input box for changing a setting value
// ---------------------------------------------------------------------------

/**
 * Register the `agentx.editSetting` command that lets users change a setting
 * value directly from the sidebar via an input box.
 */
export function registerEditSettingCommand(
  context: vscode.ExtensionContext,
  provider: SettingsTreeProvider,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentx.editSetting', async (def: SettingDef) => {
      if (!def || !def.key) { return; }

      const lastDot = def.key.lastIndexOf('.');
      const section = def.key.slice(0, lastDot);
      const key = def.key.slice(lastDot + 1);
      const current = vscode.workspace.getConfiguration(section).get<number>(key, def.defaultValue);

      const input = await vscode.window.showInputBox({
        title: `${def.label}`,
        prompt: def.tooltip,
        value: String(current),
        validateInput: (v) => {
          const n = Number(v);
          if (isNaN(n) || !Number.isInteger(n) || n < 1) {
            return 'Enter a positive integer';
          }
          return undefined;
        },
      });

      if (input === undefined) { return; } // cancelled

      const newValue = Number(input);
      await vscode.workspace.getConfiguration(section).update(key, newValue, vscode.ConfigurationTarget.Workspace);
      provider.refresh();
    }),
  );
}
