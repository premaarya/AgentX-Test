import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
import { AgentTreeProvider } from './agentTreeProvider';
import { WorkTreeProvider } from './workTreeProvider';
import { WorkflowTreeProvider } from './workflowTreeProvider';
import { TemplateTreeProvider } from './templateTreeProvider';
import { QualityTreeProvider } from './qualityTreeProvider';
import { IntegrationTreeProvider } from './integrationTreeProvider';

type RefreshableProvider = {
 refresh(): void;
};

export interface SidebarProviders {
 readonly workTreeProvider: WorkTreeProvider;
 readonly agentTreeProvider: AgentTreeProvider;
 readonly workflowTreeProvider: WorkflowTreeProvider;
 readonly templateProvider: TemplateTreeProvider;
 readonly qualityTreeProvider: QualityTreeProvider;
 readonly integrationTreeProvider: IntegrationTreeProvider;
}

export function createSidebarProviders(agentx: AgentXContext): SidebarProviders {
 return {
  workTreeProvider: new WorkTreeProvider(agentx),
  agentTreeProvider: new AgentTreeProvider(agentx),
  workflowTreeProvider: new WorkflowTreeProvider(agentx),
  templateProvider: new TemplateTreeProvider(agentx),
  qualityTreeProvider: new QualityTreeProvider(agentx),
  integrationTreeProvider: new IntegrationTreeProvider(agentx),
 };
}

export function registerSidebarProviders(providers: SidebarProviders): void {
 vscode.window.registerTreeDataProvider('agentx-work', providers.workTreeProvider);
 vscode.window.registerTreeDataProvider('agentx-agents', providers.agentTreeProvider);
 vscode.window.registerTreeDataProvider('agentx-workflow', providers.workflowTreeProvider);
 vscode.window.registerTreeDataProvider('agentx-templates', providers.templateProvider);
 vscode.window.registerTreeDataProvider('agentx-quality', providers.qualityTreeProvider);
 vscode.window.registerTreeDataProvider('agentx-integrations', providers.integrationTreeProvider);
}

export function refreshSidebarProviders(providers: SidebarProviders): void {
 const refreshableProviders: RefreshableProvider[] = [
  providers.workTreeProvider,
  providers.agentTreeProvider,
  providers.workflowTreeProvider,
  providers.templateProvider,
  providers.qualityTreeProvider,
  providers.integrationTreeProvider,
 ];

 for (const provider of refreshableProviders) {
  provider.refresh();
 }
}