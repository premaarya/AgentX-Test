import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SidebarTreeItem } from './sidebarTreeItem';

export interface AgentStatusEntry {
 readonly status?: string;
 readonly issue?: number | string | null;
 readonly lastActivity?: string | null;
}

export interface LocalIssue {
 readonly number?: number;
 readonly title?: string;
 readonly status?: string;
 readonly state?: string;
}

export function readJsonFile<T>(filePath: string): T | undefined {
 try {
  if (!fs.existsSync(filePath)) {
   return undefined;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
 } catch {
  return undefined;
 }
}

export function formatTimestamp(value: string | null | undefined): string | undefined {
 if (!value) {
  return undefined;
 }

 const date = new Date(value);
 if (Number.isNaN(date.getTime())) {
  return value;
 }

 return date.toLocaleString();
}

export function getLocalIssues(root: string): LocalIssue[] {
 const issuesDir = path.join(root, '.agentx', 'issues');
 if (!fs.existsSync(issuesDir)) {
  return [];
 }

 return fs.readdirSync(issuesDir)
  .filter((entry) => entry.endsWith('.json'))
  .map((entry) => readJsonFile<LocalIssue>(path.join(issuesDir, entry)))
  .filter((issue): issue is LocalIssue => !!issue)
  .sort((left, right) => (left.number ?? 0) - (right.number ?? 0));
}

export function buildOverviewChildren(
 root: string,
 pendingClarification: { agentName?: string } | undefined,
 openIssueCount: number,
): SidebarTreeItem[] {
 return [
  SidebarTreeItem.detail('Workspace', 'root-folder', path.basename(root), root),
  pendingClarification
   ? SidebarTreeItem.action(
    'Pending clarification',
    'comment-discussion',
    'agentx.showPendingClarification',
    'Show Pending Clarification',
    [],
    pendingClarification.agentName,
   )
   : SidebarTreeItem.detail('Pending clarification', 'comment-discussion', 'none'),
  SidebarTreeItem.detail('Open local issues', 'issues', String(openIssueCount)),
 ];
}

export function buildActiveThreadChildren(
 root: string,
 activeThread: {
  title: string;
  taskType: string;
  status: string;
  issueNumber?: number | null;
  updatedAt: string;
  planPath?: string;
 } | undefined,
 activeTurnSequence: number | undefined,
): SidebarTreeItem[] {
 if (!activeThread) {
  return [SidebarTreeItem.info('No active harness thread.')];
 }

 return [
  SidebarTreeItem.detail('Task type', 'symbol-event', activeThread.taskType),
  SidebarTreeItem.detail('Status', 'pulse', activeThread.status),
  SidebarTreeItem.detail('Current turn', 'history', String(activeTurnSequence ?? 0)),
  SidebarTreeItem.detail(
   'Issue',
   'issue-opened',
   activeThread.issueNumber ? `#${activeThread.issueNumber}` : 'none',
  ),
  SidebarTreeItem.detail('Updated', 'calendar', formatTimestamp(activeThread.updatedAt)),
  ...(activeThread.planPath
   ? [SidebarTreeItem.action(
    'Open execution plan',
    'go-to-file',
    'vscode.open',
    'Open Execution Plan',
    [vscode.Uri.file(path.join(root, activeThread.planPath))],
    activeThread.planPath,
   )]
   : []),
  ...(activeThread.issueNumber
   ? [
    SidebarTreeItem.action(
     'Open linked issue',
     'issue-opened',
     'agentx.showIssue',
     'Show Issue',
     [String(activeThread.issueNumber)],
     `#${activeThread.issueNumber}`,
    ),
    SidebarTreeItem.action(
     'Check linked issue dependencies',
     'git-merge',
     'agentx.checkDeps',
     'Check Dependencies',
     [String(activeThread.issueNumber)],
    ),
   ]
   : []),
  SidebarTreeItem.action('Loop status', 'history', 'agentx.loopStatus', 'Loop Status'),
 ];
}

export function buildActiveAgentChildren(
 activeAgents: ReadonlyArray<[string, AgentStatusEntry]>,
): SidebarTreeItem[] {
 return activeAgents.length > 0
  ? activeAgents.map(([agentName, status]) => SidebarTreeItem.action(
   agentName,
   'person',
   status.issue ? 'agentx.showIssue' : 'agentx.showStatus',
   status.issue ? 'Show Issue' : 'Show Agent Status',
   status.issue ? [String(status.issue)] : [],
   `${status.status}${status.issue ? ` | issue #${status.issue}` : ''}`,
  ))
  : [SidebarTreeItem.info('No agents are actively working.')];
}

export function buildIssueChildren(openIssues: ReadonlyArray<LocalIssue>): SidebarTreeItem[] {
 return openIssues.length > 0
  ? openIssues.slice(0, 5).map((issue) => SidebarTreeItem.action(
   `#${issue.number ?? '?'} ${issue.title ?? 'Untitled issue'}`,
   'issue-opened',
   'agentx.showIssue',
   'Show Issue',
   [String(issue.number ?? '')],
   issue.status ?? issue.state ?? 'open',
  ))
  : [SidebarTreeItem.info('No open local issues found.')];
}

export function buildActionChildren(): SidebarTreeItem[] {
 return [
  SidebarTreeItem.action('Run workflow', 'play', 'agentx.runWorkflow', 'Run Workflow'),
  SidebarTreeItem.action('Brainstorm', 'lightbulb', 'agentx.showBrainstormGuide', 'Brainstorm'),
  SidebarTreeItem.action('Planning learnings', 'book', 'agentx.showPlanningLearnings', 'Planning Learnings'),
  SidebarTreeItem.action('Review learnings', 'checklist', 'agentx.showReviewLearnings', 'Review Learnings'),
  SidebarTreeItem.action('Compound loop', 'layers', 'agentx.showCompoundLoop', 'Compound Loop'),
  SidebarTreeItem.action('Create learning capture', 'new-file', 'agentx.createLearningCapture', 'Create Learning Capture'),
  SidebarTreeItem.action('Capture guidance', 'archive', 'agentx.showKnowledgeCaptureGuidance', 'Knowledge Capture Guidance'),
  SidebarTreeItem.action('Review findings', 'comment-discussion', 'agentx.showReviewFindings', 'Review Findings'),
  SidebarTreeItem.action('Promote review finding', 'repo-push', 'agentx.promoteReviewFinding', 'Promote Review Finding'),
  SidebarTreeItem.action('Show agent status', 'organization', 'agentx.showStatus', 'Show Agent Status'),
  SidebarTreeItem.action('Check environment', 'beaker', 'agentx.checkEnvironment', 'Check Environment'),
  SidebarTreeItem.action('Generate digest', 'notebook', 'agentx.generateDigest', 'Generate Digest'),
 ];
}