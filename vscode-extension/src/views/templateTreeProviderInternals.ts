import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentXContext } from '../agentxContext';
import { collectAssetFiles } from '../utils/runtimeAssets';

interface TemplateInput {
 name: string;
 description: string;
 required: boolean;
 defaultValue: string;
}

export interface TemplateDef {
 name: string;
 filePath: string;
 inputs: TemplateInput[];
}

const TEMPLATE_ICONS: Record<string, string> = {
 PRD: 'file-text',
 ADR: 'law',
 SPEC: 'symbol-file',
 UX: 'color-mode',
 REVIEW: 'checklist',
 'SECURITY-PLAN': 'shield',
 PROGRESS: 'graph',
};

export class TemplateTreeItem extends vscode.TreeItem {
 children?: TemplateTreeItem[];

 constructor(
  public readonly label: string,
  public readonly collapsibleState: vscode.TreeItemCollapsibleState,
 ) {
  super(label, collapsibleState);
 }

 static info(text: string): TemplateTreeItem {
  const item = new TemplateTreeItem(text, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon('info');
  item.contextValue = 'infoItem';
  return item;
 }
}

export function resolveTemplateFiles(agentx: AgentXContext): string[] {
 return collectAssetFiles(
  agentx.workspaceRoot,
  agentx.extensionContext?.extensionPath,
  '.github/templates',
  (entry) => entry.endsWith('.md'),
 );
}

function buildInputChildren(inputs: TemplateInput[]): TemplateTreeItem[] {
 return inputs.map((input) => {
  const reqTag = input.required ? '(required)' : '(optional)';
  const defTag = input.defaultValue ? ` [default: ${input.defaultValue}]` : '';
  const label = `${input.name} ${reqTag}${defTag}`;

  const child = new TemplateTreeItem(label, vscode.TreeItemCollapsibleState.None);
  child.iconPath = new vscode.ThemeIcon(input.required ? 'star-full' : 'star-empty');
  child.tooltip = input.description || input.name;
  child.contextValue = 'templateInput';
  return child;
 });
}

export function createTemplateTreeItem(filePath: string, fileName: string): TemplateTreeItem {
 const def = parseTemplate(filePath, fileName);
 const item = new TemplateTreeItem(
  def.name,
  def.inputs.length > 0
   ? vscode.TreeItemCollapsibleState.Collapsed
   : vscode.TreeItemCollapsibleState.None,
 );

 item.iconPath = new vscode.ThemeIcon(TEMPLATE_ICONS[def.name] || 'file');
 item.command = {
  command: 'vscode.open',
  title: 'Open Template',
  arguments: [vscode.Uri.file(filePath)],
 };
 item.tooltip = `Open ${def.name} template (${def.inputs.length} input${def.inputs.length !== 1 ? 's' : ''})`;
 item.description = `${def.inputs.length} input${def.inputs.length !== 1 ? 's' : ''}`;
 item.contextValue = 'templateItem';
 if (def.inputs.length > 0) {
  item.children = buildInputChildren(def.inputs);
 }

 return item;
}

export function parseTemplate(filePath: string, fileName: string): TemplateDef {
 const name = fileName.replace(/-TEMPLATE\.md$/i, '').replace(/\.md$/i, '');
 const inputs: TemplateInput[] = [];

 try {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
   const fm = fmMatch[1];
   const inputsMatch = fm.match(/^inputs:\s*\r?\n([\s\S]*)/m);
   if (inputsMatch) {
    const block = inputsMatch[1];
    const lines = block.split(/\r?\n/);
    let currentInput: Partial<TemplateInput> | null = null;

    for (const line of lines) {
     const keyMatch = line.match(/^ (\w[\w-]*):\s*$/);
     if (keyMatch) {
      if (currentInput && currentInput.name) {
       inputs.push({
        name: currentInput.name,
        description: currentInput.description || '',
        required: currentInput.required || false,
        defaultValue: currentInput.defaultValue || '',
       });
      }
      currentInput = { name: keyMatch[1] };
      continue;
     }

     if (currentInput) {
      const propMatch = line.match(/^\s{2,}(\w+):\s*(.*)$/);
      if (propMatch) {
       const [, prop, val] = propMatch;
       const cleanVal = val.replace(/^["']|["']$/g, '').trim();
       switch (prop) {
        case 'description':
         currentInput.description = cleanVal;
         break;
        case 'required':
         currentInput.required = cleanVal === 'true';
         break;
        case 'default':
         currentInput.defaultValue = cleanVal;
         break;
       }
      }
     }
    }

    if (currentInput && currentInput.name) {
     inputs.push({
      name: currentInput.name,
      description: currentInput.description || '',
      required: currentInput.required || false,
      defaultValue: currentInput.defaultValue || '',
     });
    }
   }
  }
 } catch {
  // Ignore unreadable template files and surface zero inputs.
 }

 return { name, filePath, inputs };
}