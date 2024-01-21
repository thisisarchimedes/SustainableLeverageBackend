import { Config, loadConfig } from '../lib/ConfigService';
import { Signer, ethers } from 'ethers';
import { WBTC, WBTC_DECIMALS } from '../constants';
import { Contracts, EthereumAddress, Logger, PositionLiquidator } from "@thisisarchimedes/backend-sdk";
import UniSwap from '../lib/UniSwap';
import TransactionSimulator from '../lib/TransactionSimulator';
import DataSource from '../lib/DataSource';

const GAS_PRICE_MULTIPLIER = 3n;
const GAS_PRICE_DENOMINATOR = 2n;

// TODO: increase gas for stucked transactions
// TODO: etherscan api

/**
 * Liquidator class
 * Contains a function that runs over the LIVE positions and simulates the liquidation tx
 * on each of them, if it does not revert, executes the liquidation tx
 */
export default class Liquidator {
  private config!: Config;
  private dataSource = new DataSource();
  private txSimulator: TransactionSimulator;
  private positionLiquidator!: PositionLiquidator;

  constructor(private signer: Signer, private logger: Logger) {
    this.txSimulator = new TransactionSimulator(signer);
  }

  public initialize = async () => {
    if (this.config !== undefined) {
      throw new Error("Initialized already");
    }
    this.config = await loadConfig();
    this.positionLiquidator = Contracts.leverage.positionLiquidator(this.config.positionLiquidator, this.signer);
  }

  public run = async (signer: Signer, logger: Logger) => {
    if (this.config === undefined) {
      throw new Error("Liquidator is not initialized");
    }

    // Configure gas price
    let gasPrice = await (await signer.provider!.getFeeData()).gasPrice;
    if (gasPrice && GAS_PRICE_MULTIPLIER && GAS_PRICE_DENOMINATOR) {
      gasPrice = gasPrice * GAS_PRICE_MULTIPLIER / GAS_PRICE_DENOMINATOR;
    }

    // Query to get all nftIds
    const res = await this.dataSource.getLivePositions();

    let liquidatedCount = 0;

    const promises = [];
    for (const row of res.rows) {
      try {
        const nftId: number = Number(row.nftId);
        const strategyShares: number = Number(row.strategyShares);
        const strategy = new EthereumAddress(row.strategy);
        if (isNaN(nftId)) {
          console.error(`Position nftId/strategyShares is not a number`);
          logger.error(`Position nftId/strategyShares is not a number`);
          continue;
        }

        // Simulate the transaction
        // console.log('Building payload for:', nftId); // Debug
        promises.push(this.getClosePositionSwapPayload(strategy, strategyShares).then((payload) => {
          return new Promise<void>((resolve) => {
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

            // console.log('Simulating transaction:', nftId); // Debug

            // Simulate the transaction
            this.txSimulator.simulateAndRunTransaction(tx)
              .then(() => {
                liquidatedCount++;
                resolve();
              })
              .catch((error) => {
                if (error.data === "0x5e6797f9") { // NotEligibleForLiquidation selector
                  console.log(`Position ${nftId} is not eligible for liquidation`);
                  logger.info(`Position ${nftId} is not eligible for liquidation`);
                } else {
                  console.error(`Position ${nftId} liquidation errored with:`, error);
                  logger.error(`Position ${nftId} liquidation errored with:`);
                  logger.error(error);
                }
                resolve();
              });
          });
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error(`Position ${row.nftId} liquidation errored with:`, error);
        logger.error(`Position ${row.nftId} liquidation errored with:`);
        logger.error(error);
      }
    }

    // Await for the processes to finish
    await Promise.allSettled(promises);

    if (liquidatedCount === 0) {
      console.log(`No positions liquidated`);
      logger.info(`No positions liquidated`)
    } else {
      console.warn(`${liquidatedCount} out of ${res.rows.length} positions liquidated`);
      logger.warning(`${liquidatedCount} out of ${res.rows.length} positions liquidated`);
    }
  }

  /**
   * Returns the swap payload to close the position
   * @param provider Ethers provider
   * @param config Contracts addresses
   * @param nftId The position nftId to get the swap payload for
   * @returns string - swap payload to close the position
   */
  private getClosePositionSwapPayload = async (strategy: EthereumAddress, strategyShares: number): Promise<string> => {
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