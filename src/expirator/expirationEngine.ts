import {EthereumAddress, ClosePositionParamsStruct, Logger} from '@thisisarchimedes/backend-sdk';
import DataSource from '../lib/DataSource';
import LeveragePosition from '../types/LeveragePosition';
import {ethers, ZeroAddress} from 'ethers';
import Uniswap from '../lib/Uniswap';
import {WBTC_ADDRESS, WBTC_DECIMALS, LVBTC_DECIMALS, SWAP_ROUTE} from '../constants';
import PositionExpirator from './contracts/PositionExpirator';
import CurvePool from './contracts/CurvePool';
import {MultiPoolStrategyFactory} from './MultiPoolStrategyFactory';
import PositionLedger from './contracts/PositionLedger';
import ExpirationEngineParams from '../types/ExpirationEngineParams';
import {Config} from '../lib/ConfigService';
import WBTCVault from './contracts/WBTCVault';
import ERC20 from './contracts/ERC20';

interface PoolBalances {
  wbtc: bigint;
  lvbtc: bigint;
}

interface ExpirationEngineConfig {
  minWbtcRatio: number;
  maxWbtcRatio: number;
  targetWbtcRatio: number;
}

/**
 * Position Expirator Engine class
 */
export class ExpirationEngine {
  private readonly positionExpirator: PositionExpirator;
  private readonly positionLedger: PositionLedger;
  private readonly curvePool: CurvePool;
  private readonly WBTC_INDEX: number;
  private readonly LVBTC_INDEX: number;
  private readonly dataSource: DataSource;
  private readonly multiPoolStrategyFactory: MultiPoolStrategyFactory;
  private readonly wallet: ethers.Wallet;
  private readonly uniswap: Uniswap;
  private readonly addressesConfig: Config;
  private readonly wbtcVault: WBTCVault;
  private readonly logger: Logger;
  private readonly config: ExpirationEngineConfig;
  private readonly wbtcInstance: ERC20;

  constructor(params: ExpirationEngineParams) {
    this.positionExpirator = params.positionExpirator;
    this.positionLedger = params.positionLedger;
    this.dataSource = params.DB;
    this.logger = params.logger;
    this.curvePool = params.curvePool;
    this.WBTC_INDEX = params.tokenIndexes['WBTC'];
    this.LVBTC_INDEX = params.tokenIndexes['LVBTC'];
    this.multiPoolStrategyFactory = params.multiPoolStrategyFactory;
    this.wallet = params.wallet;
    this.uniswap = params.uniswapInstance;
    this.addressesConfig = params.addressesConfig;
    this.wbtcVault = params.wbtcVault;
    this.wbtcInstance = params.wbtcInstance;
    this.config = {
      minWbtcRatio: params.minWbtcRatio,
      maxWbtcRatio: params.maxWbtcRatio,
      targetWbtcRatio: params.targetWbtcRatio,
    };
  }

  /**
   * Preview the expiration of a position
   * @param position - The position to preview
   * @returns The minimum WBTC and payload
   */
  public async previewExpirePosition(position: LeveragePosition): Promise<{
    minimumWBTC: bigint;
    payload: string;
  }> {
    const strategyInstance = this.multiPoolStrategyFactory.create(new EthereumAddress(position.strategy));

    // get blockchain position
    const blockchainPosition = await this.positionLedger.getPosition(position.nftId);

    const minimumExpectedAssets = await strategyInstance.convertToAssets(blockchainPosition.strategyShares);

    const strategyAsset = await strategyInstance.asset();
    const assetDecimals = await strategyInstance.decimals();

    const {payload, swapOutputAmount} = await this.uniswap.buildPayload(
        ethers.formatUnits(minimumExpectedAssets, assetDecimals),
        new EthereumAddress(strategyAsset),
        Number(assetDecimals),
        new EthereumAddress(WBTC_ADDRESS),
        WBTC_DECIMALS,
    );

    return {
      minimumWBTC: BigInt(ethers.parseUnits(swapOutputAmount, WBTC_DECIMALS)),
      payload,
    };
  }

  /**
   * Get the balances of the Curve pool
   * @returns The balances of the pool
   */
  public async getCurvePoolBalances(): Promise<PoolBalances> {
    try {
      const indices = [this.WBTC_INDEX, this.LVBTC_INDEX].sort();
      const balancesPromises = indices.map((index) => {
        return this.curvePool.balances(index);
      });
      const [wbtcBalance, lvbtcBalance] = await Promise.all(balancesPromises);
      return {
        wbtc: wbtcBalance,
        lvbtc: lvbtcBalance,
      };
    } catch (error) {
      this.logger.error(`Error fetching pool balances: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get the WBTC ratio of the pool
   * @param poolBalances - The balances of the pool
   * @returns The WBTC ratio
   */
  private getPoolWBTCRatio(poolBalances: PoolBalances): number {
    const wbtcBalance = Number(poolBalances.wbtc) / 10 ** WBTC_DECIMALS;
    const lvBtcBalance = Number(poolBalances.lvbtc) / 10 ** LVBTC_DECIMALS;

    if (lvBtcBalance === 0) {
      throw new Error('lvBTC balance is zero, can\'t calculate ratio');
    }

    const ratio = wbtcBalance / lvBtcBalance;

    return ratio;
  }

  /**
   * Run the position expirator bot
   * @returns The amount of BTC acquired
   */
  public async run(): Promise<bigint> {
    this.logger.info('Running position expirator bot');

    const poolBalances = await this.getCurvePoolBalances();
    const wbtcRatio = this.getPoolWBTCRatio(poolBalances);

    this.logger.info(`Curve pool WBTC: ${poolBalances.wbtc}`);
    this.logger.info(`Curve pool LVBTC: ${poolBalances.lvbtc}`);

    if (wbtcRatio < this.config.minWbtcRatio) {
      return this.handleLowWbtcRatio(poolBalances, wbtcRatio);
    } else if (wbtcRatio > this.config.maxWbtcRatio) {
      return this.handleHighWbtcRatio(poolBalances, wbtcRatio);
    } else {
      this.logger.info(`LvBTC pool is balanced. Ratio: ${wbtcRatio}\n WBTC ${poolBalances.wbtc}\n LvBTC ${poolBalances.lvbtc}`);
      return 0n;
    }
  }

  private async handleLowWbtcRatio(poolBalances: PoolBalances, wbtcRatio: number): Promise<bigint> {
    this.logger.warning(`LVBTC pool is unbalanced. WBTC ratio: ${wbtcRatio}\n WBTC ${poolBalances.wbtc}\n LvBTC ${poolBalances.lvbtc}`);

    const btcToAcquire = this.calculateBtcToAcquire(poolBalances.wbtc, poolBalances.lvbtc, this.config.targetWbtcRatio);
    this.logger.info(`Need to acquire ${Number(btcToAcquire) / 10e8} BTC from expired positions.`);

    if (btcToAcquire === 0n) {
      return 0n;
    }

    const currentBlock = await this.getCurrentBlock();
    this.logger.info(`Expirator current block ${currentBlock}`);

    if (currentBlock === 0) {
      this.logger.error('Could not fetch latest block! Terminating.');
      return 0n;
    }

    const sortedExpirationPositions = await this.getSortedExpirationPositions(currentBlock);
    this.logger.info(`There are ${sortedExpirationPositions.length} positions available to expire`);

    const btcAcquired = await this.expirePositionsUntilBtcAcquired(sortedExpirationPositions, btcToAcquire);

    if (btcAcquired > 0n) {
      await this.rebalancePoolWithWbtcVault();
    }

    return btcAcquired;
  }

  private async handleHighWbtcRatio(poolBalances: PoolBalances, wbtcRatio: number): Promise<bigint> {
    this.logger.warning(`LVBTC pool has excess WBTC. WBTC ratio: ${wbtcRatio}\n WBTC ${poolBalances.wbtc}\n LvBTC ${poolBalances.lvbtc}`);

    const excessWbtc = poolBalances.wbtc - (poolBalances.lvbtc * BigInt(Math.floor(this.config.maxWbtcRatio * 1000))) / 1000n;

    if (excessWbtc > 0n) {
      await this.wbtcVault.swapToWBTC(excessWbtc, 1n);
      this.logger.info(`Transferred ${Number(excessWbtc) / 10e8} WBTC from the pool to the WBTC vault`);
    }

    return 0n;
  }

  private async rebalancePoolWithWbtcVault(): Promise<void> {
    const wbtcVaultBalance = await this.wbtcInstance.balanceOf(this.addressesConfig.wbtcVault);
    const curveWBTCBalance = await this.curvePool.balances(this.WBTC_INDEX);

    await this.wbtcVault.swapToLVBTC(wbtcVaultBalance, 1n);

    this.logger.info('wbtcVault Balance ' + wbtcVaultBalance);
    this.logger.info('curve WBTC Balance ' + curveWBTCBalance);
  }

  /**
   * Get the current block number
   * @returns The current block number
   */
  public async getCurrentBlock(): Promise<number> {
    const currentBlock = await this.wallet.provider?.getBlockNumber();
    return currentBlock ?? 0;
  }

  /**
   * Get the positions eligible for expiration, sorted by expiration block
   * @param currentBlock - The current block number
   * @returns The positions eligible for expiration
   */
  public async getSortedExpirationPositions(currentBlock: number): Promise<LeveragePosition[]> {
    const livePositions = await this.dataSource.getLivePositions();
    const eligibleForExpiration = livePositions.filter((position) => position.positionExpireBlock < currentBlock);
    return eligibleForExpiration.sort((a, b) => a.positionExpireBlock - b.positionExpireBlock);
  }

  /**
   * Expire positions until the required amount of BTC is acquired
   * @param sortedExpirationPositions - The positions eligible for expiration
   * @param btcToAcquire - The amount of BTC to acquire
   * @returns The amount of BTC acquired
   */
  private async expirePositionsUntilBtcAcquired(
      sortedExpirationPositions: LeveragePosition[],
      btcToAcquire: bigint,
  ): Promise<bigint> {
    let btcAcquired = 0n;

    for (const position of sortedExpirationPositions) {
      let {minimumWBTC, payload} = await this.previewExpirePosition(position);
      const wbtcVaultBalanceBefore = await this.wbtcInstance.balanceOf(this.addressesConfig.wbtcVault);

      const SLIPPAGE = 200n; // represent 0.5%

      // add 0.5% slippage tollerance
      minimumWBTC = minimumWBTC - (minimumWBTC / SLIPPAGE);
      await this.expirePosition(position.nftId, payload, minimumWBTC);

      const wbtcVaultAfter = await this.wbtcInstance.balanceOf(this.addressesConfig.wbtcVault);
      const totalAcquired = wbtcVaultAfter - wbtcVaultBalanceBefore;

      this.logger.info(`Position: ${position.nftId} expired. acquired ${Number(totalAcquired) / 10e8} BTC`);

      btcAcquired += totalAcquired;
      if (btcAcquired >= btcToAcquire) {
        this.logger.info(`Acquired ${Number(btcAcquired) / 10e8} BTC out of: ${Number(btcToAcquire) / 10e8}. stopping bot`);
        break;
      }
    }
    return btcAcquired;
  }

  /**
   * Expire a position
   * @param nftId - The ID of the NFT
   * @param payload - The payload
   * @param minimumWBTC - The minimum amount of WBTC
   */
  private async expirePosition(nftId: number, payload: string, minimumWBTC: bigint): Promise<void> {
    const closeParams: ClosePositionParamsStruct = {
      nftId: nftId,
      minWBTC: minimumWBTC,
      swapRoute: SWAP_ROUTE,
      swapData: payload,
      exchange: ZeroAddress,
    };

    this.logger.info(`position nftId = ${nftId} sent to expiration`);
    await this.positionExpirator.expirePosition(nftId, closeParams);
  }

  // utils/calculations.ts

  /**
   * Calculates the amount of WBTC needed to balance a liquidity pool to a certain ratio.
   *
   * @param wbtcBalance - The current balance of WBTC in the pool.
   * @param lvBtcBalance - The current balance of LVBTC in the pool.
   * @param targetRatio - The desired ratio of WBTC to LVBTC in the pool.
   * This is a numerical value where 1 represents a 1:1 ratio, 0.5 represents a 1:2 ratio (WBTC:LVBTC),
   * 2 represents a 2:1 ratio, and so on.
   * It essentially dictates the proportion of WBTC to LVBTC that you aim to achieve in the pool.
   * @returns The amount of WBTC needed to balance the pool to the target ratio.
   */
  calculateBtcToAcquire(wbtcBalance: bigint, lvBtcBalance: bigint, targetRatio: number): bigint {
    // Convert the target ratio to a fraction
    const targetFraction = 1 / targetRatio;

    // Calculate the amount of WBTC needed to balance the pool
    const requiredWbtc = BigInt(Math.ceil(Number(lvBtcBalance) * targetFraction)) - wbtcBalance;

    return requiredWbtc < 0n ? 0n : requiredWbtc;
  }
}
