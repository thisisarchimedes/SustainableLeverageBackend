/* eslint-disable no-extra-semi */
/* eslint-disable semi */
import {ethers} from 'ethers';
import {Logger} from '@thisisarchimedes/backend-sdk';
import DataSource from '../lib/DataSource';
import Uniswap from '../lib/Uniswap';
import {TokenIndexes} from '../types/TokenIndexes';
import PositionExpirator from '../expirator/contracts/PositionExpirator';
import CurvePool from '../expirator/contracts/CurvePool';
import {MultiPoolStrategyFactory} from '../expirator/MultiPoolStrategyFactory';
import PositionLedger from '../expirator/contracts/PositionLedger';
import {Config} from '../lib/ConfigService';

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
    addressesConfig: Config;
};
