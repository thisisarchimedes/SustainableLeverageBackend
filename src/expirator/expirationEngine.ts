import { Logger, EthereumAddress, ClosePositionParamsStruct } from '@thisisarchimedes/backend-sdk';
import { BigNumber } from 'bignumber.js';
import DataSource from '../lib/DataSource';
import LeveragePosition from '../types/LeveragePosition';
import { ethers } from 'ethers';
import Uniswap from '../lib/Uniswap';
import { WBTC, WBTC_DECIMALS } from '../constants';
import { TokenIndexes } from '../types/TokenIndexes';
import PositionExpirator from './contracts/PositionExpirator';
import CurvePool from './contracts/CurvePool';
import { MultiPoolStrategyFactory } from './MultiPoolStrategyFactory';

const ZERO_ADDRESS = ethers.ZeroAddress;
const SWAP_ROUTE = 0;
const PRECISION_FACTOR = 1000000;

/**
 * Position Expirator Engine class
 */
export class ExpirationEngine {
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

  /**
 * Preview the expiration of a position
 * @param {LeveragePosition} position - The position to preview
 * @returns {Promise<{minimumWBTC: bigint, payload: string}>} The minimum WBTC and payload
 */
  public async previewExpirePosition(position: LeveragePosition) {
    const strategyInstance = this.multiPoolStrategyFactory.create(new EthereumAddress(position.strategy));

    const minimumExpectedAssets = await strategyInstance.convertToAssets(ethers.parseEther(position.strategyShares.toString()));

    const strategyAsset = await strategyInstance.asset();
    const assetDecimals = await strategyInstance.decimals();

    const { payload, swapOutputAmount } = await this.uniswap.buildPayload(
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

  /**
 * Get the balances of the Curve pool
 * @returns {Promise<bigint[]>} The balances of the pool
 */
  async getCurvePoolBalances(): Promise<bigint[]> {
    try {
      const indices = [this.WBTC_INDEX, this.LVBTC_INDEX].sort();
      const balancesPromises = indices.map((index) => {
        return this.curvePool.balances(index);
      });
      const balances = await Promise.all(balancesPromises);
      return balances;
    } catch (error) {
      this.logger.error(`Error fetching pool balances: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
 * Get the WBTC ratio of the pool
 * @param {bigint[]} poolBalances - The balances of the pool
 * @returns {number} The WBTC ratio
 */
  public getPoolWBTCRatio(poolBalances: bigint[]): number {
    const wbtcBalance = new BigNumber(poolBalances[this.WBTC_INDEX].toString());
    const lvBtcBalance = new BigNumber(poolBalances[this.LVBTC_INDEX].toString());

    if (lvBtcBalance.isZero()) {
      throw new Error('lvBTC balance is zero, can\'t calculate ratio');
    }

    const ratio = wbtcBalance.dividedBy(lvBtcBalance);

    return ratio.toNumber();
  }

  /**
  * Run the position expirator bot
  * @returns {Promise<bigint>} The amount of BTC acquired
  */
  public async run(): Promise<bigint> {
    this.logger.info('Running position expirator bot');

    const poolBalances = await this.getCurvePoolBalances();
    const wbtcRatio = this.getPoolWBTCRatio(poolBalances);

    let btcAquired: bigint = BigInt(0);
    if (wbtcRatio < this.poolRektThreshold) {
      this.logger.warning(`LVBTC pool is unbalanced. WBTC ratio: ${wbtcRatio}`);

      const btcToAquire = this.calculateBtcToAcquire(poolBalances[0], poolBalances[1], this.poolRektThreshold);

      this.logger.warning(`need to aquire ${btcToAquire} BTC from expired positions.`);

      const currentBlock = await this.getCurrentBlock();

      if (currentBlock > 0) {
        const sortedExpirationPositions = await this.getSortedExpirationPositions(currentBlock);

        this.logger.info(`There are ${sortedExpirationPositions.length} positions avaliable to expire`);

        btcAquired = await this.expirePositionsUntilBtcAcquired(sortedExpirationPositions, btcToAquire);
      } else {
        this.logger.error('Could not fetch latest block! terminating.');
        return btcAquired;
      }
    } else {
      this.logger.info('LVBTC Pool is balanced. no need to expire positions');
    }

    return btcAquired;
  }

  /**
   * Calculate the amount of BTC to acquire
   * @param {bigint[]} poolBalances - The balances of the pool
   * @returns {bigint} The amount of BTC to acquire
   */

  public calculateBtcToAcquire(wbtcBalance: bigint, lvBtcBalance: bigint, targetRatio: number): bigint {
    // Convert target_ratio to bigint
    const targetRatioBigInt = BigInt(Math.floor(targetRatio * PRECISION_FACTOR));
    const hundredThousand = BigInt(PRECISION_FACTOR);

    // Calculate the amount of WBTC to add
    const x = (targetRatioBigInt * lvBtcBalance) / hundredThousand - wbtcBalance;

    // Ensure that the result is non-negative
    return x > 0n ? x : 0n;
  }


  /**
  * Get the current block number
  * @returns {Promise<number>} The current block number
  */
  public async getCurrentBlock(): Promise<number> {
    const currentBlock = await this.wallet.provider?.getBlockNumber();
    return currentBlock || 0;
  }

  /**
 * Get the positions eligible for expiration, sorted by expiration block
 * @param {number} currentBlock - The current block number
 * @returns {Promise<LeveragePosition[]>} The positions eligible for expiration
 */
  public async getSortedExpirationPositions(currentBlock: number): Promise<LeveragePosition[]> {
    const livePositions = await this.DB.getLivePositions();
    const eligibleForExpiration = livePositions.filter((position) => position.positionExpireBlock < currentBlock);
    return eligibleForExpiration.sort((a, b) => a.positionExpireBlock - b.positionExpireBlock);
  }

  /**
 * Expire positions until the required amount of BTC is acquired
 * @param {LeveragePosition[]} sortedExpirationPositions - The positions eligible for expiration
 * @param {bigint} btcToAquire - The amount of BTC to acquire
 * @returns {Promise<bigint>} The remaining amount of BTC to acquire
 */
  public async expirePositionsUntilBtcAcquired(sortedExpirationPositions: LeveragePosition[], btcToAquire: bigint): Promise<bigint> {
    for (const position of sortedExpirationPositions) {
      btcToAquire = await this.expirePositionAndCalculateRemainingBtc(position, btcToAquire);
      if (btcToAquire <= 0) {
        this.logger.info('Aquired enough BTC, breaking bot');
        break;
      }
    }
    return btcToAquire;
  }

  /**
 * Expire a position and calculate the remaining amount of BTC to acquire
 * @param {LeveragePosition} position - The position to expire
 * @param {bigint} btcToAquire - The amount of BTC to acquire
 * @returns {Promise<bigint>} The remaining amount of BTC to acquire
 */
  private async expirePositionAndCalculateRemainingBtc(position: LeveragePosition, btcToAquire: bigint): Promise<bigint> {
    const { minimumWBTC, payload } = await this.previewExpirePosition(position);
    await this.expirePosition(position.nftId, payload, minimumWBTC);
    return btcToAquire - minimumWBTC;
  }

  /**
 * Expire a position
 * @param {number} nftId - The ID of the NFT
 * @param {string} payload - The payload
 * @param {bigint} minimumWBTC - The minimum amount of WBTC
 * @returns {Promise<void>}
 */
  private async expirePosition(nftId: number, payload: string, minimumWBTC: bigint): Promise<void> {
    const closeParams: ClosePositionParamsStruct = {
      nftId: nftId,
      swapData: payload,
      minWBTC: minimumWBTC,
      swapRoute: SWAP_ROUTE,
      exchange: ZERO_ADDRESS,
    };

    this.logger.info(`position ${nftId} sent to expiration`);
    await this.positionExpirator.expirePosition(nftId, closeParams);
  }
}
