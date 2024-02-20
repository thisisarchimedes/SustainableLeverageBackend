
import dotenv from 'dotenv';
dotenv.config();

import {ExpirationEngine} from './expirationEngine';
import {Logger, EthereumAddress} from '@thisisarchimedes/backend-sdk';
import {ethers} from 'ethers';
import DataSource from '../lib/DataSource';
import Uniswap from '../lib/Uniswap';
import {TokenIndexes} from '../types/TokenIndexes';
import PositionExpirator from './contracts/PositionExpirator';
import CurvePool from './contracts/CurvePool';
import {MultiPoolStrategyFactory} from './MultiPoolStrategyFactory';
import PositionLedger from './contracts/PositionLedger';
import {loadConfig} from '../lib/ConfigService';


export const handler = async (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    _event: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    _context: any,
): Promise<void> => {
  Logger.initialize('Position expirator');
  const logger = Logger.getInstance();
  const config = await loadConfig();

  try {
    const privateKey = process.env.PRIVATE_KEY!;

    // Initialize the required instances
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);

    const positionExpirator = new PositionExpirator(wallet, config.positionExpirator);
    const positionLedger = new PositionLedger(wallet, config.positionLedger);
    const curvePool = new CurvePool(wallet, new EthereumAddress(process.env.MOCK_CURVE_POOL_ADDRESS!));
    const DB = new DataSource();
    const multiPoolStrategyFactory = new MultiPoolStrategyFactory(wallet);
    const uniswapInstance = new Uniswap(process.env.MAINNET_RPC_URL!);
    const tokenIndexes: TokenIndexes = {'WBTC': 0, 'LVBTC': 1};
    const poolRektThreshold = 0.7;

    // Initialize PositionExpiratorEngine
    const positionExpiratorEngine = new ExpirationEngine(
        wallet,
        logger,
        positionExpirator,
        positionLedger,
        curvePool,
        DB,
        multiPoolStrategyFactory,
        uniswapInstance,
        tokenIndexes,
        poolRektThreshold,
    );

    const btcAquired = await positionExpiratorEngine.run();

    logger.info(`btc aquired ${btcAquired}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (ex: any) {
    logger.error((ex as Error).message);
  } finally {
    await logger.flush();
  }
};
