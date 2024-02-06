import { Config, loadConfig } from '../lib/ConfigService';
import { Provider, ethers, getDefaultProvider } from 'ethers';
import { WBTC, WBTC_DECIMALS } from '../constants';
import { Contracts, EthereumAddress, Logger } from '@thisisarchimedes/backend-sdk';
import Uniswap from '../lib/Uniswap';
import TransactionSimulator from '../lib/TransactionSimulator';
import DataSource from '../lib/DataSource';

const IDLE_DELAY = 10000;
const GAS_PRICE_MULTIPLIER = 3n;
const GAS_PRICE_DENOMINATOR = 2n;

// TODO: increase gas for stucked transactions
// TODO: etherscan api

const dataSource = new DataSource();
Logger.initialize('liquidator-bot');
const logger = Logger.getInstance();
liquidator(dataSource, logger);

/*
 * Runs over the LIVE positions and simulates the liquidation tx
 * on each of them, if it does not revert, executes the liquidation tx
 * @param config Contracts addresses
 * @param dataSource A data source to get the positions from
 * @param logger Logger library
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function liquidatePosition(nftId: number, config: Config, signer: ethers.Wallet, positionLiquidator: any,
  txSimulator: TransactionSimulator, logger: Logger) {
  if (isNaN(nftId)) {
    logger.error(`Position nftId is not a number`);
    return false;
  }

  const payload = await getClosePositionSwapPayload(signer.provider!, config, nftId);

  try {
    const data = positionLiquidator.interface.encodeFunctionData('liquidatePosition', [{
      nftId,
      minWBTC: 0,
      swapRoute: '0',
      swapData: payload,
      exchange: '0x0000000000000000000000000000000000000000',
    }]);

    let gasPrice = await (await signer.provider!.getFeeData()).gasPrice;
    if (gasPrice && GAS_PRICE_MULTIPLIER && GAS_PRICE_DENOMINATOR) {
      gasPrice = gasPrice * GAS_PRICE_MULTIPLIER / GAS_PRICE_DENOMINATOR;
    }

    const tx = {
      to: config.positionLiquidator.toString(),
      data,
      gasPrice,
    };

    const response = await txSimulator.simulateAndRunTransaction(tx);
    await response.wait();
    logger.warning(`Position ${nftId} liquidated; tx hash - ${response.hash}`);
    return true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.data === '0x5e6797f9') {
      logger.info(`Position ${nftId} is not eligible for liquidation`);
    } else {
      logger.error(`Position ${nftId} liquidation errored with:`);
      logger.error(error);
    }
    return false;
  }
}

async function liquidator(dataSource: DataSource, logger: Logger) {
  const config = await loadConfig();
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, getDefaultProvider(process.env.RPC_URL!));
  const txSimulator = new TransactionSimulator(signer);
  const positionLiquidator = Contracts.leverage.positionLiquidator(config.positionLiquidator, signer);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const nftIds = await dataSource.getLivePositions();
    let liquidatedCount = 0;

    for (const nftId of nftIds) {
      const wasLiquidated = await liquidatePosition(nftId, config, signer, positionLiquidator, txSimulator, logger);
      if (wasLiquidated) {
        liquidatedCount++;
      }
    }

    if (liquidatedCount === 0) {
      logger.info(`No positions liquidated, sleeping for ${IDLE_DELAY}ms`);
      await sleep(IDLE_DELAY);
    } else {
      logger.warning(`${liquidatedCount} out of ${nftIds.length} positions liquidated`);
    }
  }
}

/*
 * Returns the swap payload to close the position
 * @param provider Ethers provider
 * @param config Contracts addresses
 * @param nftId The position nftId to get the swap payload for
 * @return string - swap payload to close the position
 */
const getClosePositionSwapPayload = async (provider: Provider, config: Config, nftId: number): Promise<string> => {
  const positionLedger = Contracts.leverage.positionLedger(config.positionLedger, provider);
  const ledgerEntry = await positionLedger.getPosition(nftId);

  const strategy = Contracts.general.multiPoolStrategy(new EthereumAddress(ledgerEntry.strategyAddress), provider);
  const strategyAsset = await strategy.asset();
  const minimumExpectedAssets = await strategy.convertToAssets(ledgerEntry.strategyShares);

  // eslint-disable-next-line new-cap
  const asset = Contracts.general.erc20(new EthereumAddress(strategyAsset), provider);
  const assetDecimals = await asset.decimals();

  const UniswapInstance = new Uniswap(process.env.MAINNET_RPC_URL!);
  const { payload } = await UniswapInstance.buildPayload(
    ethers.formatUnits(minimumExpectedAssets, assetDecimals),
    new EthereumAddress(strategyAsset),
    Number(assetDecimals),
    new EthereumAddress(WBTC),
    WBTC_DECIMALS,
  );

  return payload;
};

const sleep = (milliseconds: number) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};
