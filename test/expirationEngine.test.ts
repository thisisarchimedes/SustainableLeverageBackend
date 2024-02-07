import { expect } from 'chai';
import sinon from 'sinon';
import { PositionExpiratorEngine } from '../src/expirator/ExpirationEngine';
import { Logger } from "@thisisarchimedes/backend-sdk"
import DataSource from '../src/lib/DataSource';
import { TokenIndexes } from '../src/types/TokenIndexes';
import PositionExpirator from '../src/expirator/contracts/PositionExpirator';
import CurvePool from '../src/expirator/contracts/CurvePool';
import PositionsDummy from './dummyData/Positions.json'
import { ethers } from 'ethers';
import LeveragePositionRow from '../src/types/LeveragePosition';
import { MultiPoolStrategyFactory } from '../src/expirator/MultiPoolStrategyFactory';
import MultiPoolStrategy from '../src/expirator/contracts/MultiPoolStrategy';
import Uniswap from '../src/lib/Uniswap';

describe('PositionExpiratorEngine', () => {
    let sandbox: sinon.SinonSandbox;
    let engine: PositionExpiratorEngine;

    function createProviderStub(): sinon.SinonStubbedInstance<ethers.JsonRpcProvider> {
        const providerStub = sandbox.createStubInstance(ethers.JsonRpcProvider);
        providerStub.getBlockNumber.resolves(19144936);
        return providerStub;
    }

    function createUniswapStub(): sinon.SinonStubbedInstance<Uniswap> {

        const uniswapStub = sandbox.createStubInstance(Uniswap);

        const swapAmountOut = (10 * 10 ** 8).toString();
        uniswapStub.buildPayload.resolves({ payload: '', swapOutputAmount: swapAmountOut });

        return uniswapStub;
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
        const dataSourceStub = sandbox.createStubInstance(DataSource);
        dataSourceStub.getLivePositions.resolves(convertToLeveragePositionRows(JSON.stringify(PositionsDummy)))

        return dataSourceStub;
    }

    function createCurvePoolStub(): sinon.SinonStubbedInstance<CurvePool> {
        const curvePoolStub = sandbox.createStubInstance(CurvePool);
        curvePoolStub.balances.onFirstCall().resolves(BigInt(10 * 10 ** 8));
        curvePoolStub.balances.onSecondCall().resolves(BigInt(51 * 10 ** 8));

        return curvePoolStub;
    }

    function createMultiPoolStrategyFactoryStub(): sinon.SinonStubbedInstance<MultiPoolStrategyFactory> {
        const mockMultiPoolStrategy = sinon.createStubInstance(MultiPoolStrategy);

        mockMultiPoolStrategy.asset.resolves(ethers.ZeroAddress);
        mockMultiPoolStrategy.decimals.resolves(8);
        mockMultiPoolStrategy.convertToAssets.onCall(0).resolves(BigInt(1 * (10 ** 8)));
        mockMultiPoolStrategy.convertToAssets.onCall(1).resolves(BigInt(2 * (10 ** 8)));
        mockMultiPoolStrategy.convertToAssets.onCall(2).resolves(BigInt(3 * (10 ** 8)));
        mockMultiPoolStrategy.convertToAssets.returns(Promise.resolve(BigInt(4 * (10 ** 8))));

        const multiPoolStrategyFactoryStub = sandbox.createStubInstance(MultiPoolStrategyFactory);
        multiPoolStrategyFactoryStub.create.returns(mockMultiPoolStrategy);
        return multiPoolStrategyFactoryStub;
    }

    function setupStubs() {
        const stubs = {
            logger: sandbox.createStubInstance(Logger),
            positionExpirator: sandbox.createStubInstance(PositionExpirator),
            curvePool: createCurvePoolStub(),
            dataSource: createDatasourceSub(),
            provider: createProviderStub(),
            uniswap: createUniswapStub(),
            multiPoolStrategyFactory: createMultiPoolStrategyFactoryStub(),
        };

        return stubs;
    }

    function createEngine(stubs: any) {
        return new PositionExpiratorEngine(
            stubs.provider,
            stubs.logger,
            stubs.positionExpirator,
            stubs.curvePool,
            stubs.dataSource,
            stubs.multiPoolStrategyFactory,
            stubs.uniswap,
            { 'WBTC': 0, 'LVBTC': 1 },
            0.2
        );
    }

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        const stubs = setupStubs();
        engine = createEngine(stubs);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should return pool balances', async () => {
        const result = await engine.getCurvePoolBalances();
        expect(result).to.deep.equal([BigInt(10 * 10 ** 8), BigInt(51 * 10 ** 8)]);
    });

    it('should expire position', async () => {
        await engine.run()
    })


    it('should calculate BTC to acquire', () => {
        const poolBalances = [BigInt(10 * 10 ** 8), BigInt(51 * 10 ** 8)];
        const result = engine.calculateBtcToAcquire(poolBalances);
        expect(result).to.equal(BigInt(41 * 10 ** 8));
    });

    it('should get current block', async () => {
        const result = await engine.getCurrentBlock();
        expect(result).to.equal(19144936);
    });
});



// it('should get sorted expiration positions', async () => {
//     const result = await engine.getSortedExpirationPositions(19133668);
//     expect(result).to.be.an('array');
//     expect(result).to.have.lengthOf(PositionsDummy.length);
//     expect(result[0].positionExpireBlock).to.be.lessThan(result[1].positionExpireBlock);
// });

// it('should expire positions until BTC acquired', async () => {
//     const sortedExpirationPositions = convertToLeveragePositionRows(JSON.stringify(PositionsDummy));
//     const btcToAquire = BigInt(41 * 10 ** 8);
//     const result = await engine.expirePositionsUntilBtcAcquired(sortedExpirationPositions, btcToAquire);
//     expect(result).to.be.a('bigint');
//     expect(result).to.be.lessThan(btcToAquire);
// });

// it('should throw error when lvBTC balance is zero', async () => {
//     curvePoolStub.balances.onFirstCall().resolves(BigInt(10 * 10 ** 8));
//     curvePoolStub.balances.onSecondCall().resolves(BigInt(0));
//     try {
//         await engine.run();
//         expect.fail('Expected run to throw an error');
//     } catch (error) {
//         expect(error).to.be.an('error');
//         expect(error.message).to.equal("lvBTC balance is zero, can't calculate ratio");
//     }
// });

// it('should throw error when unable to fetch latest block', async () => {
//     providerStub.getBlockNumber.resolves(0);
//     try {
//         await engine.run();
//         expect.fail('Expected run to throw an error');
//     } catch (error) {
//         expect(error).to.be.an('error');
//         expect(error.message).to.equal("Could not fetch latest block! terminating.");
//     }
// });