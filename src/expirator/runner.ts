import dotenv from 'dotenv';
dotenv.config();

import { ExpirationEngine } from './expirationEngine';
import { Logger, EthereumAddress } from '@thisisarchimedes/backend-sdk';
import { ethers } from 'ethers';
import DataSource from '../lib/DataSource';
import { loadConfig } from '../lib/ConfigService';
import Uniswap from '../lib/Uniswap';
import { TokenIndexes } from '../types/TokenIndexes';
import PositionExpirator from './contracts/PositionExpirator';
import CurvePool from './contracts/CurvePool';
import { MultiPoolStrategyFactory } from './MultiPoolStrategyFactory';
import PositionLedger from './contracts/PositionLedger';
import cron from 'node-cron';

Logger.initialize('Position expirator');

async function mineBlocks(numBlocks: number) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  for (let i = 0; i < numBlocks; i++) {
    await provider.send('evm_mine', []);
  }
}

let isRunning = false;

async function main() {
  if (isRunning) {
    console.log('Main function is already running. Skipping this schedule.');
    return;
  }

  isRunning = true;
  const logger = Logger.getInstance();

  try {
    const privateKey = process.env.PRIVATE_KEY!;
    const config = await loadConfig();

    // Initialize the required instances
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);


    logger.info('Expirator bot running..');

    const positionExpirator = new PositionExpirator(wallet, config.positionExpirator);
    const positionLedger = new PositionLedger(wallet, config.positionLedger);
    const curvePool = new CurvePool(wallet, new EthereumAddress(process.env.MOCK_CURVE_POOL_ADDRESS!));
    const DB = new DataSource();
    const multiPoolStrategyFactory = new MultiPoolStrategyFactory(wallet);
    const uniswapInstance = new Uniswap(process.env.MAINNET_RPC_URL!);
    const tokenIndexes: TokenIndexes = { 'WBTC': 0, 'LVBTC': 1 };
    const poolRektThreshold = 0.33;

    // Initialize PositionExpiratorEngine
    const positionExpiratorEngine = new ExpirationEngine({
      wallet: wallet,
      logger: logger,
      positionExpirator: positionExpirator,
      positionLedger: positionLedger,
      curvePool: curvePool,
      DB: DB,
      multiPoolStrategyFactory: multiPoolStrategyFactory,
      uniswapInstance: uniswapInstance,
      tokenIndexes: tokenIndexes,
      poolRektThreshold: poolRektThreshold,
    });


    console.log('mining 4 blocks...');
    await mineBlocks(4);
    console.log('Running expirator');
    const result = await positionExpiratorEngine.run();
    return result;
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await logger.flush();
    isRunning = false;
  }
}

cron.schedule('*/30 * * * * *', main);
