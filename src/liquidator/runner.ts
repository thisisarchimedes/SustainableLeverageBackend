import {Provider, ethers, getDefaultProvider} from 'ethers';
import {Logger} from '@thisisarchimedes/backend-sdk';
import Liquidator from './liquidator';

/**
 * Runs the liquidator for all the live positions
 * Runs for each mined block
 * Locks the execution if it's already running
 */

(async () => {
  // Initialize
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, getDefaultProvider(process.env.RPC_URL!));

  Logger.initialize('liquidator-bot');
  const logger = Logger.getInstance();

  const liquidator = new Liquidator(signer, logger);
  await liquidator.initialize();

  let isRunning = false;

  console.log('Liquidator bot is listening for new blocks...');
  logger.info('Liquidator bot is listening for new blocks...');

  signer.provider!.on('block', async (blockNumber: number) => {
    console.log(`New block mined: ${blockNumber}`);
    logger.info(`New block mined: ${blockNumber}`);

    /*
      * Get the fork's block's timestamp for proper deadline calculation
      * for Uniswap's payload.
      * Could be removed for production
      * and use the current timestamp instead.
    */
    const currentTimestamp = await getBlockTimestamp(signer.provider!, blockNumber);

    // Prevent performActions from being called if it's already running
    if (isRunning) {
      console.warn('Already performing actions on another block. Skipping this block.');
      logger.warning('Already performing actions on another block. Skipping this block.');
      return;
    }

    // Mark as running
    isRunning = true;

    try {
      // Perform actions here
      await liquidator.run(currentTimestamp);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Error running liquidator:', error);
      logger.error('Error running liquidator:');
      logger.error(error);
    } finally {
      // Mark as not running
      isRunning = false;
    }
  });
})();

const getBlockTimestamp = async (provider: Provider, blockNumber: number): Promise<number> => {
  const block = await provider.getBlock(blockNumber);
  const currentTimestamp = block ? block.timestamp : Math.floor(Date.now() / 1000);
  return currentTimestamp;
};
