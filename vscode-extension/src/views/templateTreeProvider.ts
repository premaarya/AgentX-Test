import * as vscode from 'vscode';
import * as fs from 'fs';
import { AgentXContext } from '../agentxContext';
import {
 createTemplateTreeItem,
 parseTemplate,
 resolveTemplatesDir,
 TemplateDef,
 TemplateTreeItem,
} from './templateTreeProviderInternals';

/**
 * Tree data provider for the Templates sidebar view.
 * Shows available markdown templates from `.github/templates/`
 * with their input variables as expandable children.
 */
export class TemplateTreeProvider implements vscode.TreeDataProvider<TemplateTreeItem> {
 private _onDidChangeTreeData = new vscode.EventEmitter<TemplateTreeItem | undefined | void>();
 readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

 constructor(private agentx: AgentXContext) {}

 refresh(): void {
  this._onDidChangeTreeData.fire();
 }

 getTreeItem(element: TemplateTreeItem): vscode.TreeItem {
  return element;
 }

 async getChildren(element?: TemplateTreeItem): Promise<TemplateTreeItem[]> {
  if (element) {
   return element.children || [];
  }

   if (!this.agentx.workspaceRoot) {
    return [];
   }

  const templatesDir = resolveTemplatesDir(this.agentx);

  if (!templatesDir) {
   return [TemplateTreeItem.info('No templates found')];
  }

  const files = fs.readdirSync(templatesDir).filter((fileName) => fileName.endsWith('.md'));
  if (files.length === 0) {
   return [TemplateTreeItem.info('No templates found')];
  }

  return files.map(f => this.createTemplateItem(templatesDir, f));
 }

 /**
  * Parse a template file and build a tree item with input variable children.
  */
 private createTemplateItem(dir: string, fileName: string): TemplateTreeItem {
    return createTemplateTreeItem(dir, fileName);
 }

 /**
  * Parse frontmatter inputs from a template markdown file.
  * Handles the YAML `inputs:` block with nested keys.
  */
 static parseTemplate(filePath: string, fileName: string): TemplateDef {
  return parseTemplate(filePath, fileName);
 }
}

export { TemplateTreeItem };
