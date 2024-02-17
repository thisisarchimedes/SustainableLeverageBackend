import dotenv from 'dotenv';
dotenv.config();

import { ExpirationEngine } from './expirationEngine';
import { Logger, EthereumAddress } from '@thisisarchimedes/backend-sdk';
import { ethers } from 'ethers';
import DataSource from '../lib/DataSource';
import Uniswap from '../lib/Uniswap';
import { TokenIndexes } from '../types/TokenIndexes';
import PositionExpirator from './contracts/PositionExpirator';
import CurvePool from './contracts/CurvePool';
import { MultiPoolStrategyFactory } from './MultiPoolStrategyFactory';
import cron from 'node-cron';

Logger.initialize('Position expirator');
const privateKey = process.env.PRIVATE_KEY!;

// Initialize the required instances
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL!);
const wallet = new ethers.Wallet(privateKey, provider);

const logger = Logger.getInstance();
const positionExpirator = new PositionExpirator(wallet, new EthereumAddress(process.env.POSITION_EXPIRATOR_ADDRESS!));
const curvePool = new CurvePool(wallet, new EthereumAddress(process.env.MOCK_CURVE_POOL_ADDRESS!));
const DB = new DataSource();
const multiPoolStrategyFactory = new MultiPoolStrategyFactory(wallet);
const uniswapInstance = new Uniswap(process.env.RPC_URL!);
const tokenIndexes: TokenIndexes = { 'WBTC': 0, 'LVBTC': 1 };
const poolRektThreshold = 0.3;

async function setBlockGasLimit(gasLimitHex: any) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const method = 'evm_setBlockGasLimit';
  const params = [gasLimitHex]; // Gas limit in hexadecimal

  return provider.send(method, params);
}

async function mineOneBlock() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  return provider.send('evm_mine', []);
}

async function logLatestBlockGasLimit() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  try {
    const latestBlock = await provider.getBlock('latest');
    if (latestBlock) {
      console.log(`Latest block number: ${latestBlock.number}`);
      console.log(`Gas limit of the latest block: ${latestBlock.gasLimit.toString()}`);
    }
  } catch (error) {
    console.error('Error fetching latest block:', error);
  }
}

// Initialize PositionExpiratorEngine
const positionExpiratorEngine = new ExpirationEngine(
  wallet,
  logger,
  positionExpirator,
  curvePool,
  DB,
  multiPoolStrategyFactory,
  uniswapInstance,
  tokenIndexes,
  poolRektThreshold,
);

async function main() {
  try {
    const newGasLimit = '0x8f0d180';
    await logLatestBlockGasLimit();
    await setBlockGasLimit(newGasLimit);
    await mineOneBlock();
    console.log(`Block gas limit set to ${newGasLimit}`);
    await logLatestBlockGasLimit();
    const result = await positionExpiratorEngine.run();
    console.log(result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await logger.flush();
  }
}

main().then(a => {
  console.log(a)
});
