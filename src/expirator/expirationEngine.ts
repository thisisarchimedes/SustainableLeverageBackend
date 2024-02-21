import {Logger, EthereumAddress, ClosePositionParamsStruct, Contracts} from '@thisisarchimedes/backend-sdk';
import {BigNumber} from 'bignumber.js';
import DataSource from '../lib/DataSource';
import LeveragePosition from '../types/LeveragePosition';
import {ethers} from 'ethers';
import Uniswap from '../lib/Uniswap';
import {WBTC_ADDRESS, WBTC_DECIMALS} from '../constants';
import PositionExpirator from './contracts/PositionExpirator';
import CurvePool from './contracts/CurvePool';
import {MultiPoolStrategyFactory} from './MultiPoolStrategyFactory';
import PositionLedger from './contracts/PositionLedger';
import ExpirationEngineParams from '../types/ExpirationEngineParams';
import {Config} from '../lib/ConfigService';

const ZERO_ADDRESS = ethers.ZeroAddress;
const SWAP_ROUTE = 0;

/**
 * Position Expirator Engine class
 */
export class ExpirationEngine {
  private readonly logger: Logger;
  private readonly positionExpirator: PositionExpirator;
  private readonly positionLedger: PositionLedger;
  private readonly curvePool: CurvePool;
  private readonly WBTC_INDEX: number;
  private readonly LVBTC_INDEX: number;
  private readonly poolRektThreshold: number;
  private readonly DB: DataSource;
  private readonly multiPoolStrategyFactory: MultiPoolStrategyFactory;
  private readonly wallet: ethers.Wallet;
  private readonly uniswap: Uniswap;
  private readonly addressesConfig: Config;


  constructor(params: ExpirationEngineParams) {
    this.logger = params.logger;
    this.positionExpirator = params.positionExpirator;
    this.positionLedger = params.positionLedger;
    this.DB = params.DB;
    this.curvePool = params.curvePool;
    this.WBTC_INDEX = params.tokenIndexes['WBTC'];
    this.LVBTC_INDEX = params.tokenIndexes['LVBTC'];
    this.poolRektThreshold = params.poolRektThreshold;
    this.multiPoolStrategyFactory = params.multiPoolStrategyFactory;
    this.wallet = params.wallet;
    this.uniswap = params.uniswapInstance;
    this.addressesConfig = params.addressesConfig;
  }

  /**
 * Preview the expiration of a position
 * @param {LeveragePosition} position - The position to preview
 * @returns {Promise<{minimumWBTC: bigint, payload: string}>} The minimum WBTC and payload
 */
  public async previewExpirePosition(position: LeveragePosition) {
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
      this.logger.warning(`LVBTC pool is unbalanced. WBTC ratio: ${wbtcRatio}\n WBTC ${poolBalances[0]}\n LvBTC ${poolBalances[1]}`);

      const btcToAquire = this.calculateBtcToAcquire(poolBalances[0], poolBalances[1], 3);

      this.logger.warning(`need to aquire ${btcToAquire / BigInt(10) ** BigInt(8)} BTC from expired positions.`);

      if (btcToAquire > 0) {
        const currentBlock = await this.getCurrentBlock();
        this.logger.info(`Expirator current block ${currentBlock}`);

        if (currentBlock > 0) {
          const sortedExpirationPositions = await this.getSortedExpirationPositions(currentBlock);

          this.logger.info(`There are ${sortedExpirationPositions.length} positions avaliable to expire`);

          btcAquired = await this.expirePositionsUntilBtcAcquired(sortedExpirationPositions, btcToAquire);
        } else {
          this.logger.error('Could not fetch latest block! terminating.');
          return btcAquired;
        }
      }
    } else {
      this.logger.info(`LvBTC pool is balanced. ratio: ${wbtcRatio}\n WBTC ${poolBalances[0]}\n LvBTC ${poolBalances[1]}`);
    }

    return btcAquired;
  }

  /**
   * Calculates the amount of WBTC needed to balance a liquidity pool to a certain ratio.
   *
   * @param {bigint} wbtcBalance - The current balance of WBTC in the pool.
   * @param {bigint} lvBtcBalance - The current balance of LVBTC in the pool.
   * @param {number} targetRatio - The desired ratio of WBTC to LVBTC in the pool.
   * This is a numerical value where 1 represents a 1:1 ratio, 0.5 represents a 1:2 ratio (WBTC:LVBTC),
   *  2 represents a 2:1 ratio, and so on.
   * It essentially dictates the proportion of WBTC to LVBTC that you aim to achieve in the pool.
   * @returns {bigint} The amount of WBTC needed to balance the pool to the target ratio.
   * @throws {Error} If the required WBTC is negative, indicating the pool is already over the target ratio.
   */
  public calculateBtcToAcquire(wbtcBalance: bigint, lvBtcBalance: bigint, targetRatio: number): bigint {
    // Convert the target ratio to a fraction
    const targetFraction = 1 / targetRatio;

    // Calculate the amount of WBTC needed to balance the pool
    const requiredWbtc = BigInt(Math.ceil(Number(lvBtcBalance) * targetFraction)) - wbtcBalance;

    return requiredWbtc < BigInt(0) ? BigInt(0) : requiredWbtc;
  }

  /**
  * Get the current block number
  * @returns {Promise<number>} The current block number
  */
  public async getCurrentBlock(): Promise<number> {
    const currentBlock = await this.wallet.provider?.getBlockNumber();
    return currentBlock ?? 0;
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
    let btcAquired = BigInt(0);
    const wbtcVaultInstance = Contracts.general.erc20(new EthereumAddress(WBTC_ADDRESS), this.wallet);
    for (const position of sortedExpirationPositions) {
      let {minimumWBTC, payload} = await this.previewExpirePosition(position);

      const wbtcVaultBalanceBefore = await wbtcVaultInstance.balanceOf(this.addressesConfig.wbtcVault.toString());


      // add 0.5% slippage tollerance
      minimumWBTC = minimumWBTC - (minimumWBTC / BigInt(200));
      await this.expirePosition(position.nftId, payload, minimumWBTC);

      const wbtcVaultBeforeAfter = await wbtcVaultInstance.balanceOf(this.addressesConfig.wbtcVault.toString());
      btcAquired += wbtcVaultBeforeAfter - wbtcVaultBalanceBefore;
      if (btcAquired >= btcToAquire) {
        this.logger.info(`Aquired ${btcAquired / BigInt(10) ** BigInt(8)} BTC.
         target: ${btcToAquire / BigInt(10) ** BigInt(8)}. breaking bot`);
        break;
      }
    }
    return btcAquired;
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
      minWBTC: minimumWBTC,
      swapRoute: SWAP_ROUTE,
      swapData: payload,
      exchange: ZERO_ADDRESS,
    };

    this.logger.info(`position nftId=${nftId} sent to expiration`);
    await this.positionExpirator.expirePosition(nftId, closeParams);
  }
}
