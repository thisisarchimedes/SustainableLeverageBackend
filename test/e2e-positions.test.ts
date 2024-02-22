import {assert} from 'chai';
import '@nomicfoundation/hardhat-ethers';
import {ethers} from 'hardhat';
import {Contracts, Logger, PositionCloser, PositionOpener} from '@thisisarchimedes/backend-sdk';
import DataSource from '../src/lib/DataSource';
import {Config, loadConfig} from '../src/lib/ConfigService';
import UniSwapPayloadBuilder from '../src/lib/UniSwapPayloadBuilder';
import {FRAXBPALUSD_STRATEGY} from './lib/addresses';
import {WBTC} from '../src/constants';
import {Wallet, getDefaultProvider} from 'ethers';

const OPEN_POSITION_COLLATERAL = 1000n;
const OPEN_POSITION_BORROW = 1000n;
const OPEN_POSITION_STRATEGY = FRAXBPALUSD_STRATEGY;
const WAIT_FOR_DB_UPDATE = 2 * 60 * 1000;

describe('E2E Positions', function() {
  let config: Config;
  let logger: Logger;
  let dataSource: DataSource;
  let signer: Wallet;
  let positionOpener: PositionOpener;
  let positionCloser: PositionCloser;
  let openedPosition = NaN;

  before(async function() {
    config = await loadConfig();
    console.log(config);
    Logger.initialize('e2e-positions-test');
    logger = Logger.getInstance();
    signer = new ethers.Wallet(process.env.PRIVATE_KEY!, getDefaultProvider(process.env.RPC_URL!));
    positionOpener = Contracts.leverage.positionOpener(config.positionOpener, signer);
    positionCloser = Contracts.leverage.positionCloser(config.positionCloser, signer);

    // Approve WBTC for position opener
    Contracts.general.erc20(WBTC, signer).approve(config.positionOpener.toString(), ethers.MaxUint256);
  });

  beforeEach(function() {
    dataSource = new DataSource(logger);
  });

  it('Open Position', async function() {
    const latestBlock = await signer.provider?.getBlock('latest');

    const totalAmount = OPEN_POSITION_COLLATERAL + OPEN_POSITION_BORROW;
    const payload = await UniSwapPayloadBuilder.getOpenPositionSwapPayload(
        signer,
        totalAmount,
        OPEN_POSITION_STRATEGY,
        latestBlock!.timestamp,
    );

    const tx = await positionOpener.openPosition({
      collateralAmount: OPEN_POSITION_COLLATERAL,
      wbtcToBorrow: OPEN_POSITION_BORROW,
      strategy: OPEN_POSITION_STRATEGY.toString(),
      minStrategyShares: 0,
      swapRoute: '0',
      swapData: payload,
      exchange: '0x0000000000000000000000000000000000000000',
    });
    const txReceipt = await tx.wait();
    assert(txReceipt!.status === 1, 'Transaction failed');
    console.log(tx, txReceipt);

    const event = txReceipt!.logs.find((event) => event['fragment']?.name === 'PositionOpened');
    assert.isDefined(event, 'PositionOpened event not found');
    openedPosition = event!['args'][0]; // The first argument in the event should be the position ID
    console.log('Position opened', openedPosition);

    console.log('Waiting for DB update...');
    await sleep(WAIT_FOR_DB_UPDATE);

    const position = await dataSource.getPosition(openedPosition);
    assert(position.positionState === 'LIVE', 'Position is not live');
  });

  it('Close Position', async function() {
    const latestBlock = await signer.provider?.getBlock('latest');

    assert.isNotNaN(openedPosition, 'Position not opened');
    const position = await dataSource.getPosition(openedPosition);
    assert(position.positionState === 'LIVE', 'Position is not live');
    assert.isNumber(Number(position.strategyShares), 'Strategy shares are not numeric');

    const payload = await UniSwapPayloadBuilder.getClosePositionSwapPayload(
        signer,
        OPEN_POSITION_STRATEGY,
        Number(position.strategyShares),
        latestBlock!.timestamp,
    );

    const tx = await positionCloser.closePosition({
      nftId: openedPosition,
      minWBTC: 0,
      swapRoute: '0',
      swapData: payload,
      exchange: '0x0000000000000000000000000000000000000000',
    });

    const txReceipt = await tx.wait();
    assert(txReceipt!.status === 1, 'Transaction failed');

    console.log('Waiting for DB update...');
    await sleep(WAIT_FOR_DB_UPDATE);

    const positionAfter = await dataSource.getPosition(openedPosition);
    assert(positionAfter.positionState === 'CLOSED', 'Position is not closed');
  });
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
