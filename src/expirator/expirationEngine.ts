import {Logger, EthereumAddress, ClosePositionParamsStruct} from '@thisisarchimedes/backend-sdk';
import {BigNumber} from 'bignumber.js';
import DataSource from '../lib/DataSource';
import LeveragePosition from '../types/LeveragePosition';
import {ethers} from 'ethers';
import Uniswap from '../lib/Uniswap';
import {WBTC, WBTC_DECIMALS} from '../constants';
import {TokenIndexes} from '../types/TokenIndexes';
import PositionExpirator from './contracts/PositionExpirator';
import CurvePool from './contracts/CurvePool';
import {MultiPoolStrategyFactory} from './MultiPoolStrategyFactory';

const ZERO_ADDRESS = ethers.ZeroAddress;
const SWAP_ROUTE = 0;

export class PositionExpiratorEngine {
  private readonly logger: Logger;
  private readonly positionExpirator: PositionExpirator;
  private readonly curvePool: CurvePool;
  private readonly WBTC_INDEX: number;
  private readonly LVBTC_INDEX: number;
  private readonly poolRektThreshold: number;
  private readonly DB: DataSource;
  private readonly multiPoolStrategyFactory: MultiPoolStrategyFactory;
  private readonly wallet: ethers.Wallet;
  private readonly uniswap: Uniswap;

  constructor(wallet: ethers.Wallet, logger: Logger, positionExpirator: PositionExpirator,
      curvePool: CurvePool, DB: DataSource, multiPoolStrategyFactory: MultiPoolStrategyFactory,
      uniswapInstance: Uniswap, tokenIndexes: TokenIndexes, poolRektThreshold: number) {
    this.logger = logger;
    this.positionExpirator = positionExpirator;
    this.DB = DB;
    this.curvePool = curvePool;
    this.WBTC_INDEX = tokenIndexes['WBTC'];
    this.LVBTC_INDEX = tokenIndexes['LVBTC'];
    this.poolRektThreshold = poolRektThreshold;
    this.multiPoolStrategyFactory = multiPoolStrategyFactory;
    this.wallet = wallet;
    this.uniswap = uniswapInstance;
  }

  public async previewExpirePosition(position: LeveragePosition) {
    const strategyInstance = this.multiPoolStrategyFactory.create(new EthereumAddress(position.strategy));

    const minimumExpectedAssets = await strategyInstance.convertToAssets(ethers.parseEther(position.strategyShares.toString()));

    const strategyAsset = await strategyInstance.asset();
    const assetDecimals = await strategyInstance.decimals();

    const {payload, swapOutputAmount} = await this.uniswap.buildPayload(
        ethers.formatUnits(minimumExpectedAssets, assetDecimals),
        new EthereumAddress(strategyAsset),
        Number(assetDecimals),
        new EthereumAddress(WBTC),
        WBTC_DECIMALS,
    );

    return {
      minimumWBTC: BigInt(swapOutputAmount),
      payload,
    };
  }

  async getCurvePoolBalances(): Promise<bigint[]> {
    try {
      const indices = [this.WBTC_INDEX, this.LVBTC_INDEX].sort();
      const balancesPromises = indices.map((index) => this.curvePool.balances(index));
      const balances = await Promise.all(balancesPromises);
      return balances;
    } catch (error) {
      this.logger.error(`Error fetching pool balances: ${(error as Error).message}`);
      throw error;
    }
  }

  public getPoolWBTCRatio(poolBalances: bigint[]): number {
    const wbtcBalance = new BigNumber(poolBalances[this.WBTC_INDEX].toString());
    const lvBtcBalance = new BigNumber(poolBalances[this.LVBTC_INDEX].toString());

    if (lvBtcBalance.isZero()) {
      throw new Error('lvBTC balance is zero, can\'t calculate ratio');
    }

    const ratio = wbtcBalance.dividedBy(lvBtcBalance);

    return ratio.toNumber();
  }

  public async run(): Promise<bigint> {
    const poolBalances = await this.getCurvePoolBalances();
    const wbtcRatio = this.getPoolWBTCRatio(poolBalances);

    let btcAquired: bigint = BigInt(0);
    if (wbtcRatio < this.poolRektThreshold) {
      const btcToAquire = this.calculateBtcToAcquire(poolBalances);
      const currentBlock = await this.getCurrentBlock();

      if (currentBlock > 0) {
        const sortedExpirationPositions = await this.getSortedExpirationPositions(currentBlock);
        btcAquired = await this.expirePositionsUntilBtcAcquired(sortedExpirationPositions, btcToAquire);
      } else {
        this.logger.error('Could not fetch latest block! terminating.');
        return btcAquired;
      }
    }

    return btcAquired;
  }

  public calculateBtcToAcquire(poolBalances: bigint[]): bigint {
    return poolBalances[this.LVBTC_INDEX] - poolBalances[this.WBTC_INDEX];
  }

  public async getCurrentBlock(): Promise<number> {
    const currentBlock = await this.wallet.provider?.getBlockNumber();
    return currentBlock || 0;
  }

  public async getSortedExpirationPositions(currentBlock: number): Promise<LeveragePosition[]> {
    const livePositions = await this.DB.getLivePositions();
    const eligibleForExpiration = livePositions.filter((position) => position.positionExpireBlock < currentBlock);
    return eligibleForExpiration.sort((a, b) => a.positionExpireBlock - b.positionExpireBlock);
  }

  public async expirePositionsUntilBtcAcquired(sortedExpirationPositions: LeveragePosition[], btcToAquire: bigint): Promise<bigint> {
    for (const position of sortedExpirationPositions) {
      this.logger.info(`Expiring position with ID: ${position.id}`);

      const {minimumWBTC, payload} = await this.previewExpirePosition(position);

      const closeParams: ClosePositionParamsStruct = {
        nftId: position.nftId,
        swapData: payload,
        minWBTC: minimumWBTC,
        swapRoute: SWAP_ROUTE,
        exchange: ZERO_ADDRESS,
      };

      await this.positionExpirator.expirePosition(position.nftId, closeParams);
      this.logger.info(`position ${position.nftId} sent to expiration`);
      btcToAquire -= minimumWBTC;
      if (btcToAquire <= 0) {
        this.logger.info('Got enough BTC, breaking');
        break;
      }
    }

    return btcToAquire;
  }
}
