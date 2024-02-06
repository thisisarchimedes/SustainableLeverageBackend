import cron from 'node-cron';
import CurvePoolMonitor from '../lib/CurvePoolMonitor';
import { Logger, PositionExpirator, PositionLedger, ClosePositionParamsStruct } from "@thisisarchimedes/backend-sdk"
import { BigNumber } from 'bignumber.js';
import DataSource from '../lib/DataSource';
import LeveragePosition from '../types/LeveragePosition';

export class PositionExpiratorEngine {

    private readonly logger: Logger;
    private readonly curvePoolMonitor: CurvePoolMonitor;
    private readonly positionLedger: PositionLedger;
    private readonly positionExpirator: PositionExpirator;

    constructor(logger: Logger, positionLedger: PositionLedger, positionExpirator: PositionExpirator, curvePoolMonitor: CurvePoolMonitor, rpcURL: string, lvWBTCPoolAddress: string) {
        this.logger = logger;
        this.curvePoolMonitor = curvePoolMonitor;
        this.positionLedger = positionLedger;
        this.positionExpirator = positionExpirator;
    }


    public async getPoolWBTCRatio(): Promise<number> {

        const poolBalances = await this.curvePoolMonitor.getPoolBalances()

        const wbtcBalance = new BigNumber(poolBalances[0].toString());
        const lvBtcBalance = new BigNumber(poolBalances[1].toString());

        if (lvBtcBalance.isZero()) {
            throw new Error("lvBTC balance is zero, can't calculate ratio");
        }

        const ratio = wbtcBalance.dividedBy(lvBtcBalance);

        return ratio.toNumber();
    }

    public async run(): Promise<void> {
        const dataSource = new DataSource();

        //check lvBTC pool state
        const wbtcRatio = await this.getPoolWBTCRatio();

        //if rekt fetch positions from DB
        if (wbtcRatio >= 0.2) {
            //fetch nftIds from DB
            const nftIds = await dataSource.getLivePositions()

            let possiblePositionsForExpiration: number[] = [];

            // for each nftId check expiration date
            for (const nftId of nftIds) {
                const isEligibleForExpiration = await this.positionLedger.isPositionEligibleForExpiration(nftId);
                if (isEligibleForExpiration) possiblePositionsForExpiration.push(nftId);
            }

            //fetch positions from DB
            const positionsToLiquidate: LeveragePosition[] = await dataSource.getPositionsByNftIds(possiblePositionsForExpiration);

            //group positions by strategy
            const groupedPositions = positionsToLiquidate.reduce((grouped, position) => {
                (grouped[position.strategy] = grouped[position.strategy] || []).push(position);
                return grouped;
            }, {} as Record<string, LeveragePosition[]>);

            //sort by expiration time within each group
            for (const strategy in groupedPositions) {
                groupedPositions[strategy].sort((a, b) => a.positionExpireBlock - b.positionExpireBlock);
            }

            for (const strategy in groupedPositions) {
                this.logger.info(`Processing strategy: ${strategy}`);

                for (const position of groupedPositions[strategy]) {
                    this.logger.info(`Processing position with ID: ${position.id}`);

                    let closeParams: ClosePositionParamsStruct = {
                        nftId: position.nftId,
                        swapData: '',
                        minWBTC: 0,
                        swapRoute: 0,
                        exchange: ''
                    }

                    await this.positionExpirator.expirePosition(position.nftId, closeParams);
                }
            }
        }

    }
}




// cron.schedule('')