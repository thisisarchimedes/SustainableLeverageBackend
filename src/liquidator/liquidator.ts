import {Config, loadConfig} from '../lib/ConfigService';
import {Signer, TransactionRequest, ethers} from 'ethers';
import pLimit from 'p-limit';
import {WBTC_ADDRESS, WBTC_DECIMALS} from '../constants';
import {Contracts, EthereumAddress, Logger, PositionLiquidator} from '@thisisarchimedes/backend-sdk';
import UniSwap from '../lib/Uniswap';
import TransactionSimulator from '../lib/TransactionSimulator';
import DataSource from '../lib/DataSource';
import LeveragePositionRow from '../types/LeveragePosition';

const MAX_CONCURRENCY = 20;
const GAS_PRICE_MULTIPLIER = 3n;
const GAS_PRICE_DENOMINATOR = 2n;

const limit = pLimit(MAX_CONCURRENCY);

/**
 * Liquidator class
 * Contains a function that runs over the LIVE positions and simulates the liquidation tx
 * on each of them, if it does not revert, executes the liquidation tx
 */
export default class Liquidator {
  private config!: Config;
  private dataSource: DataSource;
  private txSimulator: TransactionSimulator;
  private positionLiquidator!: PositionLiquidator;

  constructor(private signer: Signer, private logger: Logger) {
    this.dataSource = new DataSource();
    this.txSimulator = new TransactionSimulator(signer);
  }

  public initialize = async () => {
    if (this.config !== undefined) {
      throw new Error('Initialized already');
    }
    this.config = await loadConfig();
    this.positionLiquidator = Contracts.leverage.positionLiquidator(this.config.positionLiquidator, this.signer);
  };

  public run = async () => {
    if (this.config === undefined) {
      throw new Error('Liquidator is not initialized');
    }

    // Configure gas price
    const gasPrice = await this.configureGasPrice();

    // Query to get all live positions data
    const res = await this.dataSource.getLivePositions();

    let liquidatedCount = 0;

    // Looping through the positions and preparing the semaphore with the liquidation process
    const promises = [];
    for (const row of res) {
      try {
        const {nftId, strategy, strategyShares} = this.retrievePositionData(row); // Throws

        const promise = this.pushToSemaphore(nftId, gasPrice, strategy, strategyShares, () => {
          liquidatedCount++;
        });
        promises.push(promise);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        this.logger.error(`Position ${row.nftId} liquidation errored with [2]:`);
        this.logger.error(error);
      }
    }

    // Await for all the processes to finish
    const answers = await Promise.allSettled(promises);

    this.logRunResult(liquidatedCount, res.length);

    return {liquidatedCount, answers};
  };

  private configureGasPrice = async (): Promise<bigint | null> => {
    let gasPrice = (await this.signer.provider!.getFeeData()).gasPrice;
    if (gasPrice && GAS_PRICE_MULTIPLIER && GAS_PRICE_DENOMINATOR) {
      gasPrice = gasPrice * GAS_PRICE_MULTIPLIER / GAS_PRICE_DENOMINATOR;
    }
    return gasPrice;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private retrievePositionData = (row: LeveragePositionRow) => {
    const nftId: number = Number(row.nftId);
    const strategyShares: number = Number(row.strategyShares);
    const strategy = new EthereumAddress(row.strategy);
    if (isNaN(nftId)) {
      throw new Error(`Position nftId is not a number`);
    }

    if (isNaN(strategyShares)) {
      throw new Error(`Position strategyShares is not a number`);
    }

    return {
      nftId,
      strategy,
      strategyShares,
    };
  };

  private pushToSemaphore = (nftId: number, gasPrice: bigint | null, strategy: EthereumAddress, strategyShares: number, cb: () => void) => {
    const promise = limit(() => this.tryLiquidate(nftId, gasPrice, strategy, strategyShares).then(cb));
    return promise;
  };

  private tryLiquidate = async (nftId: number, gasPrice: bigint | null, strategy: EthereumAddress, strategyShares: number) => {
    try {
      const payload = await this.getClosePositionSwapPayload(strategy, strategyShares);
      const tx = this.prepareTransaction(nftId, gasPrice, payload);
      await this.txSimulator.simulateAndRunTransaction(tx);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      this.errorLogger(nftId, error);
      return Promise.reject(error);
    }
  };

  private prepareTransaction = (nftId: number, gasPrice: bigint | null, payload: string): TransactionRequest => {
    const data = this.positionLiquidator.interface.encodeFunctionData('liquidatePosition', [{
      nftId,
      minWBTC: 0,
      swapRoute: '0',
      swapData: payload,
      exchange: '0x0000000000000000000000000000000000000000',
    }]);

    // Create a transaction object
    const tx = {
      to: this.config.positionLiquidator.toString(),
      data,
      gasPrice,
    };

    return tx;
  };

  /**
   * Returns the swap payload to close the position
   * @param strategy strategy address
   * @param strategyShares shares amount
   * @returns string - swap payload to close the position
   */
  private getClosePositionSwapPayload = async (strategy: EthereumAddress, strategyShares: number): Promise<string> => {
    // console.log('Building payload for:', nftId); // Debug
    const strategyContract = Contracts.general.multiPoolStrategy(strategy, this.signer);
    const strategyAsset = await strategyContract.asset(); // Optimization: can get from DB
    const asset = Contracts.general.erc20(new EthereumAddress(strategyAsset), this.signer);
    const assetDecimals = await asset.decimals(); // Optimization: can get from DB
    const strategySharesN = ethers.parseUnits(strategyShares.toFixed(Number(assetDecimals)), assetDecimals); // Converting float to bigint
    const minimumExpectedAssets = await strategyContract.convertToAssets(strategySharesN); // Must query live

    const uniSwap = new UniSwap(process.env.MAINNET_RPC_URL!);
    const {payload} = await uniSwap.buildPayload(
        ethers.formatUnits(minimumExpectedAssets, assetDecimals),
        new EthereumAddress(strategyAsset),
        Number(assetDecimals),
        new EthereumAddress(WBTC_ADDRESS),
        WBTC_DECIMALS,
    );

    return payload;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private errorLogger = (nftId: number, error: any) => {
    if (error.data === '0x5e6797f9') { // NotEligibleForLiquidation selector
      this.logger.info(`Position ${nftId} is not eligible for liquidation`);
    } else {
      this.logger.error(`Position ${nftId} liquidation errored with [1]:`);
      this.logger.error(error);
    }
  };

  private logRunResult = (liquidatedCount: number, total: number) => {
    if (liquidatedCount === 0) {
      this.logger.info(`No positions liquidated`);
    } else {
      this.logger.warning(`${liquidatedCount} out of ${total} positions liquidated`);
    }
  };
}
