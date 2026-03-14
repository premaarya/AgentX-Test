import { strict as assert } from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { registerParallelDeliveryCommands } from '../../commands/parallel-delivery';
import { AgentXContext } from '../../agentxContext';

describe('registerParallelDeliveryCommands', () => {
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

  it('registers bounded parallel commands', () => {
    registerParallelDeliveryCommands(fakeContext, { workspaceRoot: 'c:/repo' } as AgentXContext);
    const registerCommand = vscode.commands.registerCommand as sinon.SinonStub;
    assert.ok(registerCommand.calledWith('agentx.showBoundedParallelRuns'));
    assert.ok(registerCommand.calledWith('agentx.assessBoundedParallelDelivery'));
    assert.ok(registerCommand.calledWith('agentx.startBoundedParallelDelivery'));
    assert.ok(registerCommand.calledWith('agentx.reconcileBoundedParallelRun'));
  });
});