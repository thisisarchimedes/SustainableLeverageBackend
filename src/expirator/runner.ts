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

import {
  Contracts,
} from '@thisisarchimedes/backend-sdk';
import { WBTC_ADDRESS } from '../constants';

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

    // const wbtcVaultInstance = Contracts.general.erc20(new EthereumAddress(WBTC_ADDRESS), wallet);

    // const wbtcVaultBalanceBefore = await wbtcVaultInstance.balanceOf(config.wbtcVault.toString());
    // console.log('WBTC vault before:', wbtcVaultBalanceBefore);
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
      addressesConfig: config,
    });


    console.log('mining 4 blocks...');
    await mineBlocks(4);
    const result = await positionExpiratorEngine.run();

    // const wbtcVaultBalanceAfter = await wbtcVaultInstance.balanceOf(config.wbtcVault.toString());
    // console.log('WBTC vault after:', wbtcVaultBalanceAfter);

    return result;
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await logger.flush();
    isRunning = false;
  }
}

cron.schedule('* * * * *', main);// every 5 mins
