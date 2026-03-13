import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import {
 getAttributionSummary,
 getAttributionTooltip,
 getCoverageSummary,
 getCoverageTooltip,
 getEvaluationSummary,
 getEvaluationTooltip,
} from '../eval/harnessEvaluator';
import {
 getAgentNativeGapSummary,
 getAgentNativeGapTooltip,
 getAgentNativeReviewSummary,
 getAgentNativeReviewTooltip,
} from '../review/agent-native-review';
import {
 getPromotableFindingSummary,
 getPromotableFindingTooltip,
 getReviewFindingSummary,
 getReviewFindingTooltip,
} from '../review/review-findings';
import { getHarnessStatusDisplay } from '../utils/harnessState';
import {
 checkHandoffGate,
 getLoopStatusDisplay,
} from '../utils/loopStateChecker';
import { SidebarTreeItem } from './sidebarTreeItem';

export class QualityTreeProvider implements vscode.TreeDataProvider<SidebarTreeItem> {
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
   return [SidebarTreeItem.info('Open a workspace folder to inspect quality gates.')];
  }

  const handoff = checkHandoffGate(root);
  const gateIcon = handoff.allowed ? 'pass-filled' : 'warning';
  const gateState = handoff.allowed ? 'ready' : 'blocked';

  const summaryChildren = [
   SidebarTreeItem.detail('Loop', 'sync', getLoopStatusDisplay(root)),
   SidebarTreeItem.detail('Harness', 'pulse', getHarnessStatusDisplay(root)),
    SidebarTreeItem.detail('Evaluation', handoff.allowed ? 'graph' : 'warning', getEvaluationSummary(this.agentx), getEvaluationTooltip(this.agentx)),
    SidebarTreeItem.detail('Coverage', 'layers', getCoverageSummary(this.agentx), getCoverageTooltip(this.agentx)),
    SidebarTreeItem.detail('Attribution', 'symbol-key', getAttributionSummary(this.agentx), getAttributionTooltip(this.agentx)),
    SidebarTreeItem.detail('Agent-native review', 'symbol-interface', getAgentNativeReviewSummary(this.agentx), getAgentNativeReviewTooltip(this.agentx)),
    SidebarTreeItem.detail('Parity gaps', 'warning', getAgentNativeGapSummary(this.agentx), getAgentNativeGapTooltip(this.agentx)),
    SidebarTreeItem.detail('Review findings', 'comment-discussion', getReviewFindingSummary(this.agentx), getReviewFindingTooltip(this.agentx)),
    SidebarTreeItem.detail('Promotable findings', 'repo-push', getPromotableFindingSummary(this.agentx), getPromotableFindingTooltip(this.agentx)),
   SidebarTreeItem.detail('Reviewer handoff', gateIcon, gateState, handoff.reason),
  ];

  const actionsChildren = [
   SidebarTreeItem.action('Loop status', 'history', 'agentx.loopStatus', 'Loop Status'),
   SidebarTreeItem.action('Start loop', 'play', 'agentx.loopStart', 'Loop Start'),
   SidebarTreeItem.action('Complete loop', 'check', 'agentx.loopComplete', 'Loop Complete'),
        SidebarTreeItem.action('Compound loop', 'layers', 'agentx.showCompoundLoop', 'Compound Loop'),
        SidebarTreeItem.action('Create learning capture', 'new-file', 'agentx.createLearningCapture', 'Create Learning Capture'),
    SidebarTreeItem.action('Agent-native review', 'symbol-interface', 'agentx.showAgentNativeReview', 'Agent-Native Review'),
    SidebarTreeItem.action('Review findings', 'comment-discussion', 'agentx.showReviewFindings', 'Review Findings'),
    SidebarTreeItem.action('Promote review finding', 'repo-push', 'agentx.promoteReviewFinding', 'Promote Review Finding'),
   SidebarTreeItem.action('Check environment', 'beaker', 'agentx.checkEnvironment', 'Check Environment'),
  ];

  return [
   SidebarTreeItem.section('Quality summary', 'checklist', summaryChildren),
   SidebarTreeItem.section('Actions', 'tools', actionsChildren),
  ];
 }
}