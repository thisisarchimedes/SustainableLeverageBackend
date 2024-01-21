import { Config, loadConfig } from '../lib/ConfigService';
import { Signer, ethers } from 'ethers';
import { WBTC, WBTC_DECIMALS } from '../constants';
import { Contracts, EthereumAddress, Logger, PositionLedger, PositionLiquidator } from "@thisisarchimedes/backend-sdk";
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
  private positionLedger!: PositionLedger;

  constructor(private signer: Signer, private logger: Logger) {
    this.txSimulator = new TransactionSimulator(signer);
  }

  public initialize = async () => {
    if (this.config !== undefined) {
      throw new Error("Initialized already");
    }
    this.config = await loadConfig();
    this.positionLiquidator = Contracts.leverage.positionLiquidator(this.config.positionLiquidator, this.signer);
    this.positionLedger = Contracts.leverage.positionLedger(this.config.positionLedger, this.signer);
  }

  public run = async (signer: Signer, logger: Logger) => {
    if (this.config === undefined) {
      throw new Error("Liquidator is not initialized");
    }

    // Query to get all nftIds
    const res = await this.dataSource.getLivePositions();

    let liquidatedCount = 0;

    for (const row of res.rows) {
      const nftId: number = Number(row.nftId);
      if (isNaN(nftId)) {
        console.error(`Position nftId is not a number`);
        logger.error(`Position nftId is not a number`);
        continue;
      }

      // Simulate the transaction
      // const payload = await this.getClosePositionSwapPayload(nftId);
      const payload = "0x00";

      const data = this.positionLiquidator.interface.encodeFunctionData('liquidatePosition', [{
        nftId,
        minWBTC: 0,
        swapRoute: "0",
        swapData: payload,
        exchange: "0x0000000000000000000000000000000000000000",
      }]);

      // Configure gas price
      let gasPrice = await (await signer.provider!.getFeeData()).gasPrice;
      if (gasPrice && GAS_PRICE_MULTIPLIER && GAS_PRICE_DENOMINATOR) {
        gasPrice = gasPrice * GAS_PRICE_MULTIPLIER / GAS_PRICE_DENOMINATOR;
      }

      // Create a transaction object
      const tx = {
        to: this.config.positionLiquidator.toString(),
        data,
        gasPrice,
      };

      try {
        // Simulate the transaction
        await this.txSimulator.simulateAndRunTransaction(tx);

        liquidatedCount++;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (error.data === "0x5e6797f9") { // NotEligibleForLiquidation selector
          console.log(`Position ${nftId} is not eligible for liquidation`);
          logger.info(`Position ${nftId} is not eligible for liquidation`);
        } else {
          console.error(`Position ${nftId} liquidation errored with:`, error);
          logger.error(`Position ${nftId} liquidation errored with:`);
          logger.error(error);
        }
      }
    }

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
  private getClosePositionSwapPayload = async (nftId: number): Promise<string> => {
    // TODO: Consider implementing caching for the resources (not the function output)
    const ledgerEntry = await this.positionLedger.getPosition(nftId);

    const strategy = Contracts.general.multiPoolStrategy(new EthereumAddress(ledgerEntry.strategyAddress), this.signer);
    const strategyAsset = await strategy.asset();
    const minimumExpectedAssets = await strategy.convertToAssets(ledgerEntry.strategyShares);
    const asset = Contracts.general.ERC20(new EthereumAddress(strategyAsset), this.signer);
    const assetDecimals = await asset.decimals();

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