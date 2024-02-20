import { expect } from 'chai';
import sinon from 'sinon';
import { ExpirationEngine } from '../src/expirator/expirationEngine';
import { Logger } from '@thisisarchimedes/backend-sdk';
import DataSource from '../src/lib/DataSource';
import PositionExpirator from '../src/expirator/contracts/PositionExpirator';
import CurvePool from '../src/expirator/contracts/CurvePool';
import PositionsDummy from './dummyData/Positions.json';
import { ethers } from 'ethers';
import LeveragePositionRow from '../src/types/LeveragePosition';
import { MultiPoolStrategyFactory } from '../src/expirator/MultiPoolStrategyFactory';
import MultiPoolStrategy from '../src/expirator/contracts/MultiPoolStrategy';
import Uniswap from '../src/lib/Uniswap';
import PositionLedger from '../src/expirator/contracts/PositionLedger';

const POOL_BALANCES = [BigInt(0.7 * 10 ** 8), BigInt(1 * 10 ** 8)];
const ZERO_BALANCE_ERROR = 'lvBTC balance is zero, can\'t calculate ratio';
const FETCH_BLOCK_ERROR = 'Could not fetch latest block! termina…';
const CURRENT_BLOCK = 19144936;

describe('PositionExpiratorEngine', function () {
  let sandbox: sinon.SinonSandbox;
  let engine: ExpirationEngine;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stubs: any;


  function createProviderStub(): sinon.SinonStubbedInstance<ethers.JsonRpcProvider> {
    const providerStub = sandbox.createStubInstance(ethers.JsonRpcProvider);
    providerStub.getBlockNumber.resolves(CURRENT_BLOCK);
    return providerStub;
  }

  function createUniswapStub(): sinon.SinonStubbedInstance<Uniswap> {
    const uniswapStub = sandbox.createStubInstance(Uniswap);

    const swapAmountOut = (10 * 10 ** 8).toString();
    uniswapStub.buildPayload.resolves({ payload: '', swapOutputAmount: swapAmountOut });

    return uniswapStub;
  }

  function convertToLeveragePositionRows(jsonData: string): LeveragePositionRow[] {
    const data = JSON.parse(jsonData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((item: any) => ({
      id: parseInt(item.id),
      nftId: parseInt(item.nftId),
      user: item.user,
      debtAmount: parseFloat(item.debtAmount),
      timestamp: new Date(parseInt(item.timestamp) * 1000),
      currentPositionValue: parseFloat(item.currentPositionValue),
      strategyShares: parseFloat(item.strategyShares),
      strategy: item.strategy,
      blockNumber: parseInt(item.blockNumber),
      positionExpireBlock: parseInt(item.positionExpireBlock),
      positionState: item.positionState,
      collateralAmount: parseFloat(item.collateralAmount),
      claimableAmount: parseFloat(item.claimableAmount),
    }));
  }

  function createDatasourceSub(): sinon.SinonStubbedInstance<DataSource> {
    const dataSourceStub = sandbox.createStubInstance(DataSource);
    dataSourceStub.getLivePositions.resolves(convertToLeveragePositionRows(JSON.stringify(PositionsDummy)));

    return dataSourceStub;
  }

  function createCurvePoolStub(): sinon.SinonStubbedInstance<CurvePool> {
    const curvePoolStub = sandbox.createStubInstance(CurvePool);
    curvePoolStub.balances.onFirstCall().resolves(BigInt(10 * 10 ** 8));
    curvePoolStub.balances.onSecondCall().resolves(BigInt(51 * 10 ** 8));

    return curvePoolStub;
  }

  function createMultiPoolStrategyFactoryStub(): sinon.SinonStubbedInstance<MultiPoolStrategyFactory> {
    const mockMultiPoolStrategy = sinon.createStubInstance(MultiPoolStrategy);

    mockMultiPoolStrategy.asset.resolves(ethers.ZeroAddress);
    mockMultiPoolStrategy.decimals.resolves(8);
    mockMultiPoolStrategy.convertToAssets.onCall(0).resolves(BigInt(1 * (10 ** 8)));
    mockMultiPoolStrategy.convertToAssets.onCall(1).resolves(BigInt(2 * (10 ** 8)));
    mockMultiPoolStrategy.convertToAssets.onCall(2).resolves(BigInt(3 * (10 ** 8)));
    mockMultiPoolStrategy.convertToAssets.returns(Promise.resolve(BigInt(4 * (10 ** 8))));

    const multiPoolStrategyFactoryStub = sandbox.createStubInstance(MultiPoolStrategyFactory);
    multiPoolStrategyFactoryStub.create.returns(mockMultiPoolStrategy);
    return multiPoolStrategyFactoryStub;
  }

  function createPositionLedgerStub(): sinon.SinonStubbedInstance<PositionLedger> {
    const mockPositionLedger = sinon.createStubInstance(PositionLedger);
    mockPositionLedger.getPosition.resolves([0, 0, 1000]);
    return mockPositionLedger;
  }

  function setupStubs() {
    const stubs = {
      logger: sandbox.createStubInstance(Logger),
      positionExpirator: sandbox.createStubInstance(PositionExpirator),
      positionLedger: createPositionLedgerStub(),
      curvePool: createCurvePoolStub(),
      dataSource: createDatasourceSub(),
      provider: createProviderStub(),
      uniswap: createUniswapStub(),
      multiPoolStrategyFactory: createMultiPoolStrategyFactoryStub(),
    };

    return stubs;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function createEngine(stubs: any) {
    return new ExpirationEngine(
      stubs.provider,
      stubs.logger,
      stubs.positionExpirator,
      stubs.positionLedger,
      stubs.curvePool,
      stubs.dataSource,
      stubs.multiPoolStrategyFactory,
      stubs.uniswap,
      { 'WBTC': 0, 'LVBTC': 1 },
      0.2,
    );
  }

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    stubs = setupStubs();
    engine = createEngine(stubs);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('should return pool balances', async function () {
    const result = await engine.getCurvePoolBalances();
    expect(result).to.deep.equal([BigInt(10 * 10 ** 8), BigInt(51 * 10 ** 8)]);
  });

  it('should aquire enough BTC from expired position', async function () {
    const btcToAquire = engine.calculateBtcToAcquire(POOL_BALANCES[0], POOL_BALANCES[1], 0.3);

    const btcAquired = await engine.run();

    expect(btcAquired > btcToAquire);
  });

  it('should calculate BTC to acquire', function () {

    console.log('POOL_BALANCES[0]', POOL_BALANCES[0])
    console.log('POOL_BALANCES[1]', POOL_BALANCES[1])

    const result = engine.calculateBtcToAcquire(POOL_BALANCES[0], POOL_BALANCES[1], 0.8);

    console.log('WBTC TO AQUIRE:', result)

    expect(result).to.equal(BigInt(5.3 * 10 ** 8));
  });

  

  it('should get current block', async function () {
    const result = await engine.getCurrentBlock();
    expect(result).to.equal(CURRENT_BLOCK);
  });

  it('should throw error when lvBTC balance is zero', async function () {
    stubs.curvePool.balances.onFirstCall().resolves(BigInt(10 * 10 ** 8));
    stubs.curvePool.balances.onSecondCall().resolves(BigInt(0));
    try {
      await engine.run();
      expect.fail('Expected run to throw an error');
    } catch (error) {
      expect(error).to.be.an('error');
      expect((error as Error).message).to.equal(ZERO_BALANCE_ERROR);
    }
  });

  it('should throw error when unable to fetch latest block', async function () {
    stubs.provider.getBlockNumber.resolves(0);
    try {
      await engine.run();
    } catch (error) {
      expect(error).to.be.an('AssertionError');
      expect((error as Error).message).to.equal(FETCH_BLOCK_ERROR);
    }
  });

  it('should get sorted expiration positions', async function () {
    const result = await engine.getSortedExpirationPositions(CURRENT_BLOCK);
    expect(result).to.be.an('array');
    expect(result).to.have.lengthOf(PositionsDummy.filter((p) => p.positionExpireBlock < CURRENT_BLOCK).length);
    expect(result[0].positionExpireBlock).to.be.lessThan(result[1].positionExpireBlock);
  });
});
