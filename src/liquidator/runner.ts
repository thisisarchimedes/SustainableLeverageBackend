import {ethers, getDefaultProvider} from 'ethers';
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
      await liquidator.run();
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
