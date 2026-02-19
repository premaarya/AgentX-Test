import * as vscode from 'vscode';
import { AgentXContext } from '../agentxContext';
export declare class InitWizardPanel {
    static currentPanel: InitWizardPanel | undefined;
    private readonly _panel;
    private readonly _extensionUri;
    private readonly _agentx;
    private _disposables;
    /**
     * Show the wizard panel (creates or reveals existing).
     */
    static createOrShow(extensionUri: vscode.Uri, agentx: AgentXContext): void;
    private constructor();
    private _onMessage;
    /** Gather workspace info and push it to the WebView. */
    private _sendInitData;
    /** Run the full installation process, reporting progress to the WebView. */
    private _runInstall;
    private _postMessage;
    private _dispose;
    private _getHtml;
}
//# sourceMappingURL=initWizardPanel.d.ts.map