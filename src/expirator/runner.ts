import { PositionExpiratorEngine } from './ExpirationEngine';
import { Logger, EthereumAddress } from '@thisisarchimedes/backend-sdk';
import { ethers } from 'ethers';
import DataSource from '../lib/DataSource';
import Uniswap from '../lib/Uniswap';
import { TokenIndexes } from '../types/TokenIndexes';
import PositionExpirator from './contracts/PositionExpirator';
import CurvePool from './contracts/CurvePool';
import { MultiPoolStrategyFactory } from './MultiPoolStrategyFactory';
import cron from 'node-cron';

Logger.initialize("Position expirator")

// Initialize the required instances
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL!);
const logger = Logger.getInstance();
const positionExpirator = new PositionExpirator(provider, new EthereumAddress('0x9d1E680678Aa89DA4CEc8D79a5062FffC525bf84'));
const curvePool = new CurvePool(provider, new EthereumAddress(''));
const DB = new DataSource();
const multiPoolStrategyFactory = new MultiPoolStrategyFactory(provider);
const uniswapInstance = new Uniswap(process.env.RPC_URL!);
const tokenIndexes: TokenIndexes = { 'WBTC': 0, 'LVBTC': 1 };
const poolRektThreshold = 0.2;

// Initialize PositionExpiratorEngine
const positionExpiratorEngine = new PositionExpiratorEngine(
    provider,
    logger,
    positionExpirator,
    curvePool,
    DB,
    multiPoolStrategyFactory,
    uniswapInstance,
    tokenIndexes,
    poolRektThreshold
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