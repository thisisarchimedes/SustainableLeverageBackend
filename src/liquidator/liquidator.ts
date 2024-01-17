import { Config } from '../lib/ConfigService';
import { Provider, ethers, getDefaultProvider } from 'ethers';
import { WBTC, WBTC_DECIMALS } from '../constants';
import { Contracts, EthereumAddress, Logger } from "@thisisarchimedes/backend-sdk";
import UniSwap from '../lib/UniSwap';
import TransactionSimulator from '../lib/TransactionSimulator';
import DataSource from '../lib/DataSource';

const GAS_PRICE_MULTIPLIER = 3n;
const GAS_PRICE_DENOMINATOR = 2n;

// TODO: increase gas for stucked transactions
// TODO: etherscan api

/**
 * Runs over the LIVE positions and simulates the liquidation tx
 * on each of them, if it does not revert, executes the liquidation tx
 * @param config Contracts addresses
 * @param dataSource A data source to get the positions from
 * @param logger Logger library
 */
export default async function liquidator(config: Config, dataSource: DataSource, logger: Logger) {
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, getDefaultProvider(process.env.RPC_URL!));
  const txSimulator = new TransactionSimulator(signer);

  // const leveragedStrategy = LeveragedStrategy__factory.connect(config.leveragedStrategy, signer);
  const positionLiquidator = Contracts.leverage.positionLiquidator(config.positionLiquidator, signer);

  // Query to get all nftIds
  const res = await dataSource.getLivePositions();

  for (const row of res.rows) {
    const nftId: number = Number(row.nftId);
    if(isNaN(nftId)) {
      console.error(`Position nftId is not a number`);
      logger.error(`Position nftId is not a number`);
      continue;
    }

    // TODO: add more conditions for liquidation

    // Simulate the transaction
    // TODO: simulate the transaction describe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = await getClosePositionSwapPayload(signer.provider!, config, nftId);

    // TODO: test that it actually does the "simulation" but not a failed tx
    // TODO: test that it actually liquidates if needed
    try {
      const data = positionLiquidator.interface.encodeFunctionData('liquidatePosition', [{
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
        to: config.positionLiquidator.toString(),
        data,
        gasPrice,
      };

      // Simulate the transaction
      const response = await txSimulator.simulatAndRunTransaction(tx);

      // Wait for the transaction to be mined
      await response.wait();
      console.warn(`Position ${nftId} liquidated; tx hash - ${response.hash}`);
      logger.warning(`Position ${nftId} liquidated; tx hash - ${response.hash}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.data === "0x5e6797f9") { // NotEligibleForLiquidation selector
        console.log(`Position ${nftId} is not eligible for liquidation`);
      } else {
        console.error(`Position ${nftId} liquidation errored with:`, error);
        logger.error(`Position ${nftId} liquidation errored with:`);
        logger.error(error);
      }
    }
  }
}

/**
 * Returns the swap payload to close the position
 * @param provider Ethers provider
 * @param config Contracts addresses
 * @param nftId The position nftId to get the swap payload for
 * @returns string - swap payload to close the position
 */
const getClosePositionSwapPayload = async (provider: Provider, config: Config, nftId: number): Promise<string> => {
  const positionLedger = Contracts.leverage.positionLedger(config.positionLedger, provider);
  const ledgerEntry = await positionLedger.getPosition(nftId);

  const strategy = Contracts.general.multiPoolStrategy(new EthereumAddress(ledgerEntry.strategyAddress), provider);
  const strategyAsset = await strategy.asset();
  const minimumExpectedAssets = await strategy.convertToAssets(ledgerEntry.strategyShares);

  const asset = Contracts.general.ERC20(new EthereumAddress(strategyAsset), provider);
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
