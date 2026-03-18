import * as fs from 'fs';
import * as path from 'path';

const WORKSPACE_PREFIXES = [
  '.github/agents/',
  '.github/templates/',
  'docs/guides/',
] as const;

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

function mapToRuntimeRelativePath(relativePath: string): string | undefined {
  const normalized = normalizeRelativePath(relativePath);
  if (normalized.startsWith('.github/agents/')) {
    return `.agentx/runtime/agents/${normalized.substring('.github/agents/'.length)}`;
  }
  if (normalized.startsWith('.github/templates/')) {
    return `.agentx/runtime/templates/${normalized.substring('.github/templates/'.length)}`;
  }
  if (normalized.startsWith('docs/guides/')) {
    return `.agentx/runtime/docs/guides/${normalized.substring('docs/guides/'.length)}`;
  }
  return undefined;
}

function mapToBundledRelativePath(relativePath: string): string | undefined {
  const normalized = normalizeRelativePath(relativePath);
  if (normalized.startsWith('.github/')) {
    return `.github/agentx/${normalized.substring('.github/'.length)}`;
  }
  if (normalized.startsWith('docs/')) {
    return `.github/agentx/docs/${normalized.substring('docs/'.length)}`;
  }
  return undefined;
}

function toAbsolutePath(root: string, relativePath: string): string {
  return path.join(root, ...normalizeRelativePath(relativePath).split('/'));
}

function collectDirEntries(dirPath: string, predicate: (entry: string) => boolean, collector: Map<string, string>): void {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  for (const entry of fs.readdirSync(dirPath).filter((candidate) => predicate(candidate))) {
    collector.set(entry, path.join(dirPath, entry));
  }
}

export function getWorkspaceAssetPath(root: string | undefined, relativePath: string): string | undefined {
  if (!root) {
    return undefined;
  }

  const absolutePath = toAbsolutePath(root, relativePath);
  return fs.existsSync(absolutePath) ? absolutePath : undefined;
}

export function getRuntimeAssetPath(root: string | undefined, relativePath: string): string | undefined {
  if (!root) {
    return undefined;
  }

  const runtimeRelativePath = mapToRuntimeRelativePath(relativePath);
  if (!runtimeRelativePath) {
    return undefined;
  }

  const absolutePath = toAbsolutePath(root, runtimeRelativePath);
  return fs.existsSync(absolutePath) ? absolutePath : undefined;
}

export function getBundledAssetPath(extensionPath: string | undefined, relativePath: string): string | undefined {
  if (!extensionPath) {
    return undefined;
  }

  const bundledRelativePath = mapToBundledRelativePath(relativePath);
  if (!bundledRelativePath) {
    return undefined;
  }

  const absolutePath = toAbsolutePath(extensionPath, bundledRelativePath);
  return fs.existsSync(absolutePath) ? absolutePath : undefined;
}

export function resolveAssetPath(
  workspaceRoot: string | undefined,
  extensionPath: string | undefined,
  relativePath: string,
): string | undefined {
  return getWorkspaceAssetPath(workspaceRoot, relativePath)
    ?? getRuntimeAssetPath(workspaceRoot, relativePath)
    ?? getBundledAssetPath(extensionPath, relativePath);
}

export function resolveWorkspaceRuntimeAssetPath(
  workspaceRoot: string | undefined,
  relativePath: string,
): string | undefined {
  const assetPath = getWorkspaceAssetPath(workspaceRoot, relativePath)
    ?? getRuntimeAssetPath(workspaceRoot, relativePath);
  if (!assetPath || !workspaceRoot) {
    return undefined;
  }

  return path.relative(workspaceRoot, assetPath).replace(/\\/g, '/');
}

export function assetExistsInWorkspaceRuntime(
  workspaceRoot: string | undefined,
  relativePath: string,
): boolean {
  return !!resolveWorkspaceRuntimeAssetPath(workspaceRoot, relativePath);
}

export function collectAssetFiles(
  workspaceRoot: string | undefined,
  extensionPath: string | undefined,
  relativeDir: string,
  predicate: (entry: string) => boolean,
): string[] {
  const normalizedDir = normalizeRelativePath(relativeDir).replace(/\/$/, '');
  const runtimeRelativeDir = mapToRuntimeRelativePath(`${normalizedDir}/`)?.replace(/\/$/, '');
  const bundledRelativeDir = mapToBundledRelativePath(`${normalizedDir}/`)?.replace(/\/$/, '');
  const files = new Map<string, string>();

  if (extensionPath && bundledRelativeDir) {
    collectDirEntries(toAbsolutePath(extensionPath, bundledRelativeDir), predicate, files);
  }
  if (workspaceRoot && runtimeRelativeDir) {
    collectDirEntries(toAbsolutePath(workspaceRoot, runtimeRelativeDir), predicate, files);
  }
  if (workspaceRoot) {
    collectDirEntries(toAbsolutePath(workspaceRoot, normalizedDir), predicate, files);
  }

  return [...files.values()].sort((left, right) => path.basename(left).localeCompare(path.basename(right)));
}

export function isWorkspaceOverridePath(filePath: string, workspaceRoot: string | undefined): boolean {
  if (!workspaceRoot) {
    return false;
  }

  const normalizedFilePath = filePath.replace(/\\/g, '/');
  return WORKSPACE_PREFIXES.some((prefix) => normalizedFilePath.startsWith(`${workspaceRoot.replace(/\\/g, '/')}/${prefix}`));
}