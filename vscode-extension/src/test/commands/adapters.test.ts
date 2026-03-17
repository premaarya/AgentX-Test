import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AgentXContext } from '../../agentxContext';
import { registerAddRemoteAdapterCommand } from '../../commands/adapters';

describe('registerAddRemoteAdapterCommand', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;
  let fakeAgentx: sinon.SinonStubbedInstance<AgentXContext>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/test/extension'),
    } as unknown as vscode.ExtensionContext;
    fakeAgentx = {} as unknown as sinon.SinonStubbedInstance<AgentXContext>;

    sandbox.stub(vscode.commands, 'registerCommand').callsFake(
      (_cmd: string, _cb: (...args: unknown[]) => unknown) => ({ dispose: () => { /* noop */ } }),
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should register agentx.addRemoteAdapter command', () => {
    registerAddRemoteAdapterCommand(fakeContext, fakeAgentx as unknown as AgentXContext);

    assert.ok(
      (vscode.commands.registerCommand as sinon.SinonStub).calledWith('agentx.addRemoteAdapter'),
    );
  });
});