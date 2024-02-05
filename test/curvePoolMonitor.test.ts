/* eslint-disable @typescript-eslint/no-unused-vars */
import {expect} from 'chai';
import sinon from 'sinon';
import {ethers} from 'ethers';
import CurveFinancePoolMonitor from '../src/lib/CurvePoolMonitor';

describe('CurveFinancePoolMonitor', function() {
  let sandbox: sinon.SinonSandbox;
  let curveFinancePoolMonitor: CurveFinancePoolMonitor;
  let contractStub: any;

  const rpcUrl = 'mock_rpc_url';
  const poolAddress = 'mock_pool_address';
  const mockAbi = [];

  beforeEach(function() {
    sandbox = sinon.createSandbox();

    // Mocking the Ethereum provider and contract
    contractStub = {
      get_balances: sandbox.stub(),
    };
    sandbox.stub(ethers, 'Contract').returns(contractStub as never);

    curveFinancePoolMonitor = new CurveFinancePoolMonitor(rpcUrl, poolAddress, mockAbi);
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('should fetch pool balances correctly', async function() {
    // Set up the stub to return a mock response
    const mockBalances = [BigInt('1000'), BigInt('2000')];
    contractStub.get_balances.resolves(mockBalances);

    const balances = await curveFinancePoolMonitor.getPoolBalances();
    expect(balances).to.deep.equal(mockBalances);
    expect(contractStub.get_balances.calledOnce).to.be.true;
  });

  it('should handle errors when fetching pool balances', async function() {
    const mockError = new Error('Mock error');
    contractStub.get_balances.rejects(mockError);

    try {
      await curveFinancePoolMonitor.getPoolBalances();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).to.equal(mockError);
    }
  });
});
