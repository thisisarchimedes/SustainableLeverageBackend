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
import WBTCVault from '../expirator/contracts/WBTCVault';
import ERC20 from '../expirator/contracts/ERC20';

export default interface ExpirationEngineParams {
    wallet: ethers.Wallet;
    logger: Logger;
    positionExpirator: PositionExpirator;
    positionLedger: PositionLedger;
    wbtcVault: WBTCVault;
    curvePool: CurvePool;
    DB: DataSource;
    multiPoolStrategyFactory: MultiPoolStrategyFactory;
    uniswapInstance: Uniswap;
    tokenIndexes: TokenIndexes;
    addressesConfig: Config;
    minWbtcRatio: number;
    maxWbtcRatio: number;
    targetWbtcRatio: number;
    wbtcInstance: ERC20;
}
