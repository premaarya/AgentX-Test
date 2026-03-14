import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerTaskBundleCommands } from '../../commands/task-bundles';
import { AgentXContext } from '../../agentxContext';

describe('registerTaskBundleCommands', () => {
  let sandbox: sinon.SinonSandbox;
  let fakeContext: vscode.ExtensionContext;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeContext = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    sandbox.stub(vscode.commands, 'registerCommand').returns({ dispose: () => undefined });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('registers the task bundle commands', () => {
    const agentx = { workspaceRoot: 'c:/repo' } as AgentXContext;

    registerTaskBundleCommands(fakeContext, agentx);

    const registerCommand = vscode.commands.registerCommand as sinon.SinonStub;
    assert.ok(registerCommand.calledWith('agentx.showTaskBundles'));
    assert.ok(registerCommand.calledWith('agentx.createTaskBundle'));
    assert.ok(registerCommand.calledWith('agentx.resolveTaskBundle'));
    assert.ok(registerCommand.calledWith('agentx.promoteTaskBundle'));
  });
});