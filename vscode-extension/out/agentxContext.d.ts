import * as vscode from 'vscode';
/**
 * Shared context for all AgentX extension components.
 * Detects workspace state, mode, and provides CLI access.
 */
export declare class AgentXContext {
    readonly extensionContext: vscode.ExtensionContext;
    /** Cached AgentX root path (invalidated on config / workspace change). */
    private _cachedRoot;
    private _cacheValid;
    constructor(extensionContext: vscode.ExtensionContext);
    /** Invalidate the cached root so the next access re-discovers it. */
    invalidateCache(): void;
    /**
     * Returns the first workspace folder path (used by the initialize command
     * which always installs into the top-level workspace folder).
     */
    get firstWorkspaceFolder(): string | undefined;
    /**
     * Returns the detected AgentX project root.
     *
     * Resolution order:
     * 1. Explicit `agentx.rootPath` setting (if set and valid).
     * 2. Search every workspace folder root for AGENTS.md + .agentx/.
     * 3. Search subdirectories of each workspace folder up to
     *    `agentx.searchDepth` levels (default 2).
     * 4. Fall back to the first workspace folder (legacy behaviour).
     */
    get workspaceRoot(): string | undefined;
    /** Check if AgentX is initialized in the current workspace. */
    checkInitialized(): Promise<boolean>;
    /** Get the configured mode (github, local). */
    getMode(): string;
    /** Get the configured shell (auto, pwsh, bash). */
    getShell(): string;
    /** Resolve the AgentX CLI command path for the current platform. */
    getCliCommand(): string;
    /** Execute an AgentX CLI subcommand and return stdout. */
    runCli(subcommand: string, args?: string[]): Promise<string>;
    /** Read an agent definition file and return parsed frontmatter fields. */
    readAgentDef(agentFile: string): Promise<AgentDefinition | undefined>;
    /** List all agent definition files. */
    listAgents(): Promise<AgentDefinition[]>;
}
export interface AgentDefinition {
    name: string;
    description: string;
    maturity: string;
    mode: string;
    model: string;
    fileName: string;
}
//# sourceMappingURL=agentxContext.d.ts.map