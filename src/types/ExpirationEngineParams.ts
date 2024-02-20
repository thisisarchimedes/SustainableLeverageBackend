import {ethers} from 'ethers';
import {Logger} from '@thisisarchimedes/backend-sdk';
import DataSource from '../lib/DataSource';
import Uniswap from '../lib/Uniswap';
import {TokenIndexes} from '../types/TokenIndexes';
import PositionExpirator from './contracts/PositionExpirator';
import CurvePool from './contracts/CurvePool';
import {MultiPoolStrategyFactory} from './MultiPoolStrategyFactory';
import PositionLedger from './contracts/PositionLedger';

export default interface ExpirationEngineParams {
    wallet: ethers.Wallet;
    logger: Logger;
    positionExpirator: PositionExpirator;
    positionLedger: PositionLedger;
    curvePool: CurvePool;
    DB: DataSource;
    multiPoolStrategyFactory: MultiPoolStrategyFactory;
    uniswapInstance: Uniswap;
    tokenIndexes: TokenIndexes;
    poolRektThreshold: number;
};
