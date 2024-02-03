import { Config, loadConfig } from '../lib/ConfigService';
import { Signer, TransactionRequest, ethers } from 'ethers';
import pLimit from 'p-limit';
import { WBTC, WBTC_DECIMALS } from '../constants';
import { Contracts, EthereumAddress, Logger, PositionLiquidator } from "@thisisarchimedes/backend-sdk";
import UniSwap from '../lib/UniSwap';
import TransactionSimulator from '../lib/TransactionSimulator';
import DataSource from '../lib/DataSource';

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
    this.dataSource = new DataSource(logger);
    this.txSimulator = new TransactionSimulator(signer);
  }

  public initialize = async () => {
    if (this.config !== undefined) {
      throw new Error("Initialized already");
    }
    this.config = await loadConfig();
    this.positionLiquidator = Contracts.leverage.positionLiquidator(this.config.positionLiquidator, this.signer);
  }

  public run = async () => {
    if (this.config === undefined) {
      throw new Error("Liquidator is not initialized");
    }

    // Configure gas price
    let gasPrice = await (await this.signer.provider!.getFeeData()).gasPrice;
    if (gasPrice && GAS_PRICE_MULTIPLIER && GAS_PRICE_DENOMINATOR) {
      gasPrice = gasPrice * GAS_PRICE_MULTIPLIER / GAS_PRICE_DENOMINATOR;
    }

    // Query to get all nftIds
    const res = await this.dataSource.getLivePositions();

    let liquidatedCount = 0;

    // Looping through the positions and simulating the liquidation tx for each
    const promises = [];
    for (const row of res.rows) {
      try {
        const nftId: number = Number(row.nftId);
        const strategyShares: number = Number(row.strategyShares);
        const strategy = new EthereumAddress(row.strategy);
        if (isNaN(nftId)) {
          this.logger.error(`Position nftId/strategyShares is not a number`);
          continue;
        }

        // Simulate the transaction
        const promise = limit(() =>
          this.getClosePositionSwapPayload(strategy, strategyShares)
            .then((payload) => this.prepareTransaction(nftId, gasPrice, payload))
            .then((tx) => this.txSimulator.simulateAndRunTransaction(tx))
            .then(() => liquidatedCount++)
            .catch((error) => {
              if (error.data === "0x5e6797f9") { // NotEligibleForLiquidation selector
                this.logger.info(`Position ${nftId} is not eligible for liquidation`);
              } else {
                this.logger.error(`Position ${nftId} liquidation errored with [1]:`);
                this.logger.error(error);
              }
              return Promise.reject(error);
            })
        );
        promises.push(promise);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        this.logger.error(`Position ${row.nftId} liquidation errored with [2]:`);
        this.logger.error(error);
      }
    }

    // Await for the processes to finish
    const answers = await Promise.allSettled(promises);

    if (liquidatedCount === 0) {
      this.logger.info(`No positions liquidated`)
    } else {
      this.logger.warning(`${liquidatedCount} out of ${res.rows.length} positions liquidated`);
    }

    return { liquidatedCount, answers };
  }

  private prepareTransaction = (nftId: number, gasPrice: bigint | null, payload: string): TransactionRequest => {
    const data = this.positionLiquidator.interface.encodeFunctionData('liquidatePosition', [{
      nftId,
      minWBTC: 0,
      swapRoute: "0",
      swapData: payload,
      exchange: "0x0000000000000000000000000000000000000000",
    }]);

    // Create a transaction object
    const tx = {
      to: this.config.positionLiquidator.toString(),
      data,
      gasPrice,
    };

    return tx;
  }

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
    const asset = Contracts.general.ERC20(new EthereumAddress(strategyAsset), this.signer);
    const assetDecimals = await asset.decimals(); // Optimization: can get from DB
    const strategySharesN = ethers.parseUnits(strategyShares.toFixed(Number(assetDecimals)), assetDecimals);
    const minimumExpectedAssets = await strategyContract.convertToAssets(strategySharesN); // Must query live

    const uniSwap = new UniSwap(process.env.MAINNET_RPC_URL!);
    const { payload } = await uniSwap.buildPayload(
      ethers.formatUnits(minimumExpectedAssets, assetDecimals),
      new EthereumAddress(strategyAsset),
      Number(assetDecimals),
      new EthereumAddress(WBTC),
      WBTC_DECIMALS,
    );

    return payload;
  }
}