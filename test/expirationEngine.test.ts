import { expect } from 'chai';
import sinon from 'sinon';
import { PositionExpiratorEngine } from '../src/expirator/expirationEngine';
import { Logger } from "@thisisarchimedes/backend-sdk"
import DataSource from '../src/lib/DataSource';
import { TokenIndexes } from '../src/types/TokenIndexes';
import PositionExpirator from '../src/expirator/contracts/PositionExpirator';
import CurvePool from '../src/expirator/contracts/CurvePool';
import PositionsDummy from './dummyData/Positions.json'
import { ethers } from 'ethers';
import LeveragePositionRow from '../src/types/LeveragePosition';

describe('PositionExpiratorEngine', () => {
    let sandbox: sinon.SinonSandbox;
    let engine: PositionExpiratorEngine;
    let loggerStub: sinon.SinonStubbedInstance<Logger>;
    let positionExpiratorStub: sinon.SinonStubbedInstance<PositionExpirator>;
    let curvePoolStub: sinon.SinonStubbedInstance<CurvePool>;
    let dataSourceStub: sinon.SinonStubbedInstance<DataSource>;
    let providerStub: sinon.SinonStubbedInstance<ethers.JsonRpcProvider>;
    let tokenIndexes: TokenIndexes;

    function createProviderStub(): sinon.SinonStubbedInstance<ethers.JsonRpcProvider> {
        providerStub = sandbox.createStubInstance(ethers.JsonRpcProvider);
        providerStub.getBlockNumber.resolves(19133668);
        return providerStub;
    }

    function convertToLeveragePositionRows(jsonData: string): LeveragePositionRow[] {
        const data = JSON.parse(jsonData);
        return data.map((item: any) => ({
            id: parseInt(item.id),
            nftId: parseInt(item.nftId),
            user: item.user,
            debtAmount: parseFloat(item.debtAmount),
            timestamp: new Date(parseInt(item.timestamp) * 1000),
            currentPositionValue: parseFloat(item.currentPositionValue),
            strategyShares: parseFloat(item.strategyShares),
            strategy: item.strategy,
            blockNumber: parseInt(item.blockNumber),
            positionExpireBlock: parseInt(item.positionExpireBlock),
            positionState: item.positionState,
            collateralAmount: parseFloat(item.collateralAmount),
            claimableAmount: parseFloat(item.claimableAmount),
        }));
    }

    function createDatasourceSub(): sinon.SinonStubbedInstance<DataSource> {
        dataSourceStub = sandbox.createStubInstance(DataSource);
        dataSourceStub.getLivePositions.resolves(convertToLeveragePositionRows(JSON.stringify(PositionsDummy)))

        return dataSourceStub;
    }

    function createCurvePoolStub(): sinon.SinonStubbedInstance<CurvePool> {
        curvePoolStub = sandbox.createStubInstance(CurvePool);
        curvePoolStub.balances.onFirstCall().resolves(BigInt(10 * 10 ** 8));
        curvePoolStub.balances.onSecondCall().resolves(BigInt(30 * 10 ** 8));

        return curvePoolStub;

    }

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Create a stubbed instance of Logger
        loggerStub = sandbox.createStubInstance(Logger);
        positionExpiratorStub = sandbox.createStubInstance(PositionExpirator);
        curvePoolStub = createCurvePoolStub();
        dataSourceStub = createDatasourceSub();
        providerStub = createProviderStub();
        tokenIndexes = { 'WBTC': 0, 'LVBTC': 1 };

        engine = new PositionExpiratorEngine(providerStub, loggerStub, positionExpiratorStub, curvePoolStub, dataSourceStub, tokenIndexes, 0.5);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should return pool balances', async () => {
        const result = await engine.getPoolBalances();

        expect(result).to.deep.equal([BigInt(10 * 10 ** 8), BigInt(30 * 10 ** 8)]);
    });

    it('should expire position', async () => {

        await engine.run()

    })

});