import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { readHarnessState } from '../utils/harnessState';
import { evaluateWorkflowGuidance } from '../utils/workflowGuidance';
import { SidebarTreeItem } from './sidebarTreeItem';
import * as path from 'path';
import {
 AgentStatusEntry,
 buildActionChildren,
 buildActiveAgentChildren,
 buildActiveThreadChildren,
 buildIssueChildren,
 buildOverviewChildren,
 buildWorkflowGuidanceChildren,
 getLocalIssues,
 readJsonFile,
} from './workTreeProviderInternals';

export class WorkTreeProvider implements vscode.TreeDataProvider<SidebarTreeItem> {
 private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<SidebarTreeItem | undefined | void>();
 readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

 constructor(private readonly agentx: AgentXContext) {}

 refresh(): void {
  this.onDidChangeTreeDataEmitter.fire();
 }

 getTreeItem(element: SidebarTreeItem): vscode.TreeItem {
  return element;
 }

 async getChildren(element?: SidebarTreeItem): Promise<SidebarTreeItem[]> {
  if (element) {
   return element.children ?? [];
  }

  const root = this.agentx.workspaceRoot;
  if (!root) {
   return [SidebarTreeItem.info('Open a workspace folder to see current work.')];
  }

  const pendingClarification = await this.agentx.getPendingClarification();
  const harnessState = readHarnessState(root);
  const activeThread = harnessState.threads.find((thread) => thread.status === 'active');
  const activeTurn = activeThread
   ? harnessState.turns.find((turn) => turn.id === activeThread.currentTurnId)
   : undefined;
  const agentStatuses = readJsonFile<Record<string, AgentStatusEntry>>(
   path.join(root, '.agentx', 'state', 'agent-status.json'),
  ) ?? {};
  const activeAgents = Object.entries(agentStatuses)
   .filter(([, value]) => value.status && value.status !== 'idle')
   .sort(([left], [right]) => left.localeCompare(right));
  const localIssues = getLocalIssues(root);
  const openIssues = localIssues.filter((issue) => (issue.state ?? 'open') !== 'closed');

  const overviewChildren = buildOverviewChildren(root, pendingClarification, openIssues.length);
    const workflowGuidanceChildren = buildWorkflowGuidanceChildren(
     evaluateWorkflowGuidance(root, !!pendingClarification),
    );
  const activeThreadChildren = buildActiveThreadChildren(root, activeThread, activeTurn?.sequence);
  const activeAgentChildren = buildActiveAgentChildren(activeAgents);
  const issueChildren = buildIssueChildren(openIssues);
  const actionChildren = buildActionChildren();

  return [
   SidebarTreeItem.section('Overview', 'dashboard', overviewChildren),
     SidebarTreeItem.section('Next step', 'debug-step-over', workflowGuidanceChildren),
   SidebarTreeItem.section(
    activeThread ? activeThread.title : 'Active thread',
    'run-all',
    activeThreadChildren,
    activeThread ? activeThread.status : 'idle',
   ),
   SidebarTreeItem.section('Active agents', 'organization', activeAgentChildren, String(activeAgents.length)),
   SidebarTreeItem.section('Open issues', 'issues', issueChildren, String(openIssues.length)),
   SidebarTreeItem.section('Actions', 'tools', actionChildren),
  ];
 }
}