import dotenv from 'dotenv';
dotenv.config();

import {PositionExpiratorEngine} from './ExpirationEngine';
import {Logger, EthereumAddress} from '@thisisarchimedes/backend-sdk';
import {ethers} from 'ethers';
import DataSource from '../lib/DataSource';
import Uniswap from '../lib/Uniswap';
import {TokenIndexes} from '../types/TokenIndexes';
import PositionExpirator from './contracts/PositionExpirator';
import CurvePool from './contracts/CurvePool';
import {MultiPoolStrategyFactory} from './MultiPoolStrategyFactory';
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
const tokenIndexes: TokenIndexes = {'WBTC': 0, 'LVBTC': 1};
const poolRektThreshold = 0.3;


// Initialize PositionExpiratorEngine
const positionExpiratorEngine = new PositionExpiratorEngine(
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

// Schedule the run function to be called every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    await positionExpiratorEngine.run();
    console.log('Run function executed successfully');
  } catch (error) {
    console.error('Error executing run function:', error);
  }
});
