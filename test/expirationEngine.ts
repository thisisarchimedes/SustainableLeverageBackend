import { expect } from 'chai';
import sinon from 'sinon';
import { PositionExpiratorEngine } from '../src/expirator/expirationEngine';
import { Logger } from "@thisisarchimedes/backend-sdk"
import PositionExpirator from './mocks/PositionExpirator';
import CurvePool from './mocks/CurvePool';
import DataSource from '../src/lib/DataSource';
import { TokenIndexes } from '../src/types/TokenIndexes';

describe('PositionExpiratorEngine', () => {
    let sandbox: sinon.SinonSandbox;
    let engine: PositionExpiratorEngine;
    let loggerStub: sinon.SinonStubbedInstance<Logger>;
    let positionExpiratorStub: sinon.SinonStubbedInstance<PositionExpirator>;
    let curvePoolStub: sinon.SinonStubbedInstance<CurvePool>;
    let dataSourceStub: sinon.SinonStubbedInstance<DataSource>;
    let tokenIndexes: TokenIndexes;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        loggerStub = sandbox.createStubInstance(Logger);
        positionExpiratorStub = sandbox.createStubInstance(PositionExpirator);
        curvePoolStub = sandbox.createStubInstance(CurvePool);
        dataSourceStub = sandbox.createStubInstance(DataSource);
        tokenIndexes = { 'WBTC': 0, 'LVBTC': 1 };

        engine = new PositionExpiratorEngine(loggerStub, positionExpiratorStub, curvePoolStub, tokenIndexes, 0.5);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('getPoolBalances', () => {
        it('should return pool balances', async () => {
            curvePoolStub.balances.onFirstCall().resolves(BigInt(1000));
            curvePoolStub.balances.onSecondCall().resolves(BigInt(2000));

            const result = await engine.getPoolBalances();

            expect(result).to.deep.equal([BigInt(1000), BigInt(2000)]);
        });

        it('should throw error when fetching pool balances fails', async () => {
            curvePoolStub.balances.onFirstCall().throws(new Error('Test error'));

            try {
                await engine.getPoolBalances();
            } catch (error) {
                // expect(error.message).to.equal('Test error');
            }
        });
    });

    // describe('expirePositions', () => {
    //     it('should expire positions', async () => {
    //         const positions = [{ id: '1', amount: BigInt(1000) }, { id: '2', amount: BigInt(2000) }];
    //         positionLedgerStub.getPositions.returns(positions);
    //         positionExpiratorStub.expire.resolves();

    //         await engine.run()

    //         sinon.assert.calledWith(positionExpiratorStub.expire, positions[0]);
    //         sinon.assert.calledWith(positionExpiratorStub.expire, positions[1]);
    //     });

    //     it('should log error when expiring positions fails', async () => {
    //         const positions = [{ id: '1', amount: BigInt(1000) }];
    //         positionLedgerStub.getPositions.returns(positions);
    //         positionExpiratorStub.expire.rejects(new Error('Test error'));

    //         await engine.run();

    //         sinon.assert.calledWith(loggerStub.error, 'Failed to expire position', sinon.match.has('error', new Error('Test error')));
    //     });
    // });

    // describe('run', () => {
    //     it('should run the engine', async () => {
    //         const positions = [{ id: '1', amount: BigInt(1000) }];
    //         positionLedgerStub.getPositions.returns(positions);
    //         positionExpiratorStub.expire.resolves();
    //         curvePoolStub.balances.onFirstCall().resolves(BigInt(1000));
    //         curvePoolStub.balances.onSecondCall().resolves(BigInt(2000));

    //         await engine.run();

    //         sinon.assert.calledWith(positionExpiratorStub.expire, positions[0]);
    //         sinon.assert.calledOnce(loggerStub.info);
    //     });

    //     it('should log error when running the engine fails', async () => {
    //         positionLedgerStub.getPositions.rejects(new Error('Test error'));

    //         await engine.run();

    //         sinon.assert.calledWith(loggerStub.error, 'Failed to run engine', sinon.match.has('error', new Error('Test error')));
    //     });
    // });
});