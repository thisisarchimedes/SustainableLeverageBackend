import { expect } from 'chai';
import sinon from 'sinon';
import { ExpirationEngine } from '../src/expirator/expirationEngine';
import { EthereumAddress, Logger } from '@thisisarchimedes/backend-sdk';
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
import WBTCVault from '../src/expirator/contracts/WBTCVault';
import { loadConfig } from '../src/lib/ConfigService';


const POOL_BALANCES = [BigInt(1 * 10 ** 8), BigInt(3 * 10 ** 8)];
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

  function createDatasourceStub(): sinon.SinonStubbedInstance<DataSource> {
    const dataSourceStub = sandbox.createStubInstance(DataSource);
    dataSourceStub.getLivePositions.resolves(convertToLeveragePositionRows(JSON.stringify(PositionsDummy)));

    return dataSourceStub;
  }

  function createWBTCVaultStub(): sinon.SinonStubbedInstance<WBTCVault> {
    const wbtcVaultStub = sandbox.createStubInstance(WBTCVault);
    return wbtcVaultStub;
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
    mockPositionLedger.getPosition.resolves({
      positionOpenBlock: BigInt(0),
      positionExpirationBlock: BigInt(0),
      PositionState: 0,
      liquidationBuffer: BigInt(0),
      claimableAmount: BigInt(0),
      wbtcDebtAmount: BigInt(0),
      strategyShares: BigInt(1000),
      collateralAmount: BigInt(0),
      strategyAddress: new EthereumAddress('0xb6057e08a11da09a998985874FE2119e98dB3D5D'),
    });
    return mockPositionLedger;
  }

  function setupStubs() {
    const stubs = {
      logger: sandbox.createStubInstance(Logger),
      positionExpirator: sandbox.createStubInstance(PositionExpirator),
      positionLedger: createPositionLedgerStub(),
      curvePool: createCurvePoolStub(),
      dataSource: createDatasourceStub(),
      wbtcVault: createWBTCVaultStub(),
      provider: createProviderStub(),
      uniswapInstance: createUniswapStub(),
      multiPoolStrategyFactory: createMultiPoolStrategyFactoryStub(),
    };

    return stubs;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function createEngine(stubs: any) {

    const config = await loadConfig();

    return new ExpirationEngine({
      wallet: stubs.provider,
      logger: stubs.logger,
      positionExpirator: stubs.positionExpirator,
      positionLedger: stubs.positionLedger,
      curvePool: stubs.curvePool,
      DB: stubs.dataSource,
      multiPoolStrategyFactory: stubs.multiPoolStrategyFactory,
      uniswapInstance: stubs.uniswapInstance,
      tokenIndexes: { 'WBTC': 0, 'LVBTC': 1 },
      addressesConfig: config,
      wbtcVault: stubs.wbtcVault,
      minWbtcRatio: 0.25,
      maxWbtcRatio: 0.4,
      targetWbtcRatio: 0.3,
    });
  }

  beforeEach(async function () {
    sandbox = sinon.createSandbox();
    stubs = setupStubs();
    engine = await createEngine(stubs);
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

    expect(Number(btcAquired / BigInt(10) ** BigInt(8))).to.be.greaterThan(Number(btcToAquire / BigInt(10) ** BigInt(8)));
  });

  it('should calculate BTC to acquire', function () {
    const result = engine.calculateBtcToAcquire(POOL_BALANCES[0], POOL_BALANCES[1], 1.8);

    expect(Number(result)).to.approximately(66666667, 0.0001);
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
