import cron from 'node-cron';
import { Logger, PositionExpirator, PositionLedger, ClosePositionParamsStruct, Contracts, EthereumAddress, CurvePool } from "@thisisarchimedes/backend-sdk"
import { BigNumber } from 'bignumber.js';
import DataSource from '../lib/DataSource';
import LeveragePosition from '../types/LeveragePosition';
import { ethers } from 'ethers';
import Uniswap from '../lib/Uniswap';
import { WBTC, WBTC_DECIMALS } from '../constants';
import { TokenIndexes } from '../types/TokenIndexes';


export class PositionExpiratorEngine {

    private readonly logger: Logger;
    private readonly positionLedger: PositionLedger;
    private readonly positionExpirator: PositionExpirator;
    private readonly curvePool: CurvePool;
    private readonly WBTC_INDEX: number;
    private readonly LVBTC_INDEX: number;
    private readonly DB: DataSource;

    constructor(logger: Logger, positionLedger: PositionLedger, positionExpirator: PositionExpirator, curvePool: CurvePool, tokenIndexes: TokenIndexes) {
        this.logger = logger;
        this.positionLedger = positionLedger;
        this.positionExpirator = positionExpirator;
        this.DB = new DataSource();
        this.curvePool = curvePool;
        this.WBTC_INDEX = tokenIndexes['WBTC'];
        this.LVBTC_INDEX = tokenIndexes['LVBTC'];
    }

    public async previewClosePosition(position: LeveragePosition) {
        const strategyInstance = Contracts.general.multiPoolStrategy(new EthereumAddress(position.strategy), this.positionExpirator.runner ?? undefined);

        const minimumExpectedAssets = await strategyInstance.convertToAssets(position.strategyShares);
        const strategyAsset = await strategyInstance.asset();
        const assetDecimals = await strategyInstance.decimals();

        const uniswapInstance = new Uniswap(process.env.MAINNET_RPC_URL!);

        const { payload, swapOutputAmount } = await uniswapInstance.buildPayload(
            ethers.formatUnits(minimumExpectedAssets, assetDecimals),
            new EthereumAddress(strategyAsset),
            Number(assetDecimals),
            new EthereumAddress(WBTC),
            WBTC_DECIMALS,
        );

        return {
            minimumWBTC: BigInt(swapOutputAmount),
            payload,
        };
    }


    async getPoolBalances(): Promise<bigint[]> {
        try {
            const indices = [this.WBTC_INDEX, this.LVBTC_INDEX].sort();
            const balances: bigint[] = [];

            for (const index of indices) {
                const balance: bigint = await this.curvePool.balances(index);
                balances.push(balance);
            }

            return balances;
        } catch (error) {
            this.logger.error(`Error fetching pool balances: ${(error as Error).message}`);
            throw error;
        }
    }

    public async getPoolWBTCRatio(poolBalances: bigint[]): Promise<number> {

        const wbtcBalance = new BigNumber(this.WBTC_INDEX);
        const lvBtcBalance = new BigNumber(this.LVBTC_INDEX);

        if (lvBtcBalance.isZero()) {
            throw new Error("lvBTC balance is zero, can't calculate ratio");
        }

        const ratio = wbtcBalance.dividedBy(lvBtcBalance);

        return ratio.toNumber();
    }

    public async run(): Promise<void> {
        const poolBalances = await this.getPoolBalances();
        const wbtcRatio = await this.getPoolWBTCRatio(poolBalances);

        if (wbtcRatio >= 0.2) {
            let btcToAquire = this.calculateBtcToAcquire(poolBalances);
            const currentBlock = await this.getCurrentBlock();

            if (currentBlock > 0) {
                const sortedExpirationPositions = await this.getSortedExpirationPositions(currentBlock);
                btcToAquire = await this.expirePositionsUntilBtcAcquired(sortedExpirationPositions, btcToAquire);
            } else {
                throw new Error("Could not fetch latest block! terminating.")
            }
        }
    }

    private calculateBtcToAcquire(poolBalances: bigint[]): bigint {
        return poolBalances[this.LVBTC_INDEX] - poolBalances[this.WBTC_INDEX];
    }

    private async getCurrentBlock(): Promise<number> {
        const currentBlock = await this.positionLedger.runner?.provider?.getBlockNumber();
        return currentBlock || 0;
    }

    private async getSortedExpirationPositions(currentBlock: number): Promise<any[]> {
        const livePositions = await this.DB.getLivePositions();
        let eligibleForExpiration = livePositions.filter(position => position.positionExpireBlock > currentBlock);
        return eligibleForExpiration.sort((a, b) => a.positionExpireBlock - b.positionExpireBlock);
    }

    private async expirePositionsUntilBtcAcquired(sortedExpirationPositions: any[], btcToAquire: bigint): Promise<bigint> {
        for (const position of sortedExpirationPositions) {
            this.logger.info(`Expiring position with ID: ${position.id}`);

            const { minimumWBTC, payload } = await this.previewClosePosition(position)

            let closeParams: ClosePositionParamsStruct = {
                nftId: position.nftId,
                swapData: payload,
                minWBTC: minimumWBTC,
                swapRoute: 0,
                exchange: ethers.ZeroAddress
            }

            await this.positionExpirator.expirePosition(position.nftId, closeParams);

            btcToAquire -= minimumWBTC;

            if (btcToAquire <= 0)
                break;
        }

        return btcToAquire;
    }
}