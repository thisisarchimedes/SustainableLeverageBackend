import {assert, expect} from 'chai';
import '@nomicfoundation/hardhat-ethers';
import {ethers} from 'hardhat';
import {
  Contracts,
  EthereumAddress,
  Logger,
  PositionCloser,
  PositionLedger,
  PositionOpener,
  PositionToken,
} from '@thisisarchimedes/backend-sdk';
import DataSource from '../src/lib/DataSource';
import {Config, loadConfig} from '../src/lib/ConfigService';
import UniSwapPayloadBuilder from '../src/lib/UniSwapPayloadBuilder';
import {UNIV3_STRATEGY} from './lib/addresses';
import {WBTC, WBTC_DECIMALS} from '../src/constants';
import {Wallet, getDefaultProvider} from 'ethers';

const OPEN_POSITION_COLLATERAL = 1000n;
const OPEN_POSITION_BORROW = 1000n;
const OPEN_POSITION_STRATEGY = UNIV3_STRATEGY;
const WAIT_FOR_DB_UPDATE = 2 * 60 * 1000;

describe('E2E Positions', function() {
  let config: Config;
  let logger: Logger;
  let dataSource: DataSource;
  let signer: Wallet;
  let positionOpener: PositionOpener;
  let positionCloser: PositionCloser;
  let positionLedger: PositionLedger;
  let positionToken: PositionToken;

  before(async function() {
    console.log('RPC', process.env.RPC_URL);

    config = await loadConfig();
    console.log(config);
    Logger.initialize('e2e-positions-test');
    logger = Logger.getInstance();
    signer = new ethers.Wallet(process.env.PRIVATE_KEY!, getDefaultProvider(process.env.RPC_URL!));
    positionOpener = Contracts.leverage.positionOpener(config.positionOpener, signer);
    positionCloser = Contracts.leverage.positionCloser(config.positionCloser, signer);
    positionLedger = Contracts.leverage.positionLedger(config.positionLedger, signer);
    positionToken = Contracts.leverage.positionToken(config.positionToken, signer);

    // Approve WBTC for position opener
    Contracts.general.erc20(WBTC, signer).approve(config.positionOpener.toString(), ethers.MaxUint256);
  });

  beforeEach(function() {
    dataSource = new DataSource(logger);
  });

  it('Open and Close Position', async function() {
    // Get strategy asset decimals
    const strategyContract = Contracts.general.multiPoolStrategy(OPEN_POSITION_STRATEGY, signer);
    const strategyAsset = new EthereumAddress(await strategyContract.asset());
    const assetDecimals = await Contracts.general.erc20(strategyAsset, signer).decimals();

    // Open position test
    const wbtcVaultBal1 = await Contracts.general.erc20(WBTC, signer).balanceOf(config.wbtcVault.toString());
    let latestBlock = await signer.provider?.getBlock('latest');
    const totalAmount = OPEN_POSITION_COLLATERAL + OPEN_POSITION_BORROW;
    let payload = await UniSwapPayloadBuilder.getOpenPositionSwapPayload(
        signer,
        totalAmount,
        OPEN_POSITION_STRATEGY,
        latestBlock!.timestamp,
    );

    let tx = await positionOpener.openPosition({
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
    const openedPosition = event!['args'][0]; // The first argument in the event should be the position ID
    console.log('Position opened', openedPosition);

    console.log('Waiting for DB update...');
    await sleep(WAIT_FOR_DB_UPDATE);

    let position = await dataSource.getPosition(openedPosition);
    const onChainPosition = await positionLedger.getPosition(openedPosition);
    assert(position.positionState === 'LIVE', 'Position is not live');
    assert(onChainPosition.state === 1n, 'Position is not live on chain');
    assert(position.strategy === OPEN_POSITION_STRATEGY.toLowerCase(), 'Position strategy does not match');
    assert(onChainPosition.strategyAddress === OPEN_POSITION_STRATEGY.toString(), 'Position strategy does not match on chain');
    assert(ethers.parseUnits(position.strategyShares, assetDecimals) === onChainPosition.strategyShares, 'Strategy shares do not match');
    assert(
        ethers.parseUnits(position.collateralAmount, WBTC_DECIMALS) === onChainPosition.collateralAmount,
        'Collateral amount does not match',
    );
    assert(onChainPosition.collateralAmount === OPEN_POSITION_COLLATERAL, 'Collateral amount does not match on chain');
    assert(ethers.parseUnits(position.debtAmount, WBTC_DECIMALS) === onChainPosition.wbtcDebtAmount, 'Borrow amount does not match');
    assert(onChainPosition.wbtcDebtAmount === OPEN_POSITION_BORROW, 'Borrow amount does not match on chain');
    assert(position.timestamp === (await txReceipt!.getBlock()).timestamp, 'Position block timestamp does not match');
    assert(position.blockNumber === txReceipt!.blockNumber, 'Position open block does not match');
    assert(Number(onChainPosition.poistionOpenBlock) === txReceipt!.blockNumber, 'Position open block does not match on chain');
    assert(position.positionExpireBlock === Number(onChainPosition.positionExpirationBlock), 'Position expiration block does not match');
    assert(ethers.parseUnits(position.claimableAmount, WBTC_DECIMALS) === 0n, 'Position claimable amount is not 0');
    assert(onChainPosition.claimableAmount === 0n, 'Position claimable amount is not 0 on chain');
    assert(position.user === signer.address.toLowerCase(), 'Position does not belong to signer');
    assert(await positionToken.ownerOf(openedPosition) === signer.address, 'Nft does not belong to signer');

    const wbtcVaultBal2 = await Contracts.general.erc20(WBTC, signer).balanceOf(config.wbtcVault.toString());
    assert(wbtcVaultBal2 + OPEN_POSITION_BORROW === wbtcVaultBal1, 'WBTC vault balance incorrectly reduced');

    // Close position test
    latestBlock = await signer.provider?.getBlock('latest');

    assert.isNotNaN(openedPosition, 'Position not opened');
    position = await dataSource.getPosition(openedPosition);
    assert(position.positionState === 'LIVE', 'Position is not live');
    assert.isNumber(Number(position.strategyShares), 'Strategy shares are not numeric');

    payload = await UniSwapPayloadBuilder.getClosePositionSwapPayload(
        signer,
        OPEN_POSITION_STRATEGY,
        Number(position.strategyShares),
        latestBlock!.timestamp,
    );

    tx = await positionCloser.closePosition({
      nftId: openedPosition,
      minWBTC: 0,
      swapRoute: '0',
      swapData: payload,
      exchange: '0x0000000000000000000000000000000000000000',
    });

    const txReceipt2 = await tx.wait();
    assert(txReceipt2!.status === 1, 'Transaction failed');

    console.log('Waiting for DB update...');
    await sleep(WAIT_FOR_DB_UPDATE);

    const positionAfter = await dataSource.getPosition(openedPosition);
    const onChainPositionAfter = await positionLedger.getPosition(openedPosition);
    assert(positionAfter.positionState === 'CLOSED', 'Position is not closed');
    assert(onChainPositionAfter.state === 4n, 'Position is not live on chain');
    assert(positionAfter.strategy === OPEN_POSITION_STRATEGY.toLowerCase(), 'Position strategy does not match');
    assert(onChainPositionAfter.strategyAddress === OPEN_POSITION_STRATEGY.toString(), 'Position strategy does not match on chain');
    assert(
        ethers.parseUnits(positionAfter.currentPositionValue, assetDecimals) === 0n,
        'Current position value is not 0',
    );
    assert(
        ethers.parseUnits(positionAfter.strategyShares, assetDecimals) === onChainPositionAfter.strategyShares,
        'Strategy shares do not match',
    );
    assert(
        ethers.parseUnits(positionAfter.collateralAmount, WBTC_DECIMALS) === onChainPositionAfter.collateralAmount,
        'Collateral amount does not match',
    );
    assert(onChainPositionAfter.collateralAmount === OPEN_POSITION_COLLATERAL, 'Collateral amount does not match on chain');
    assert(
        ethers.parseUnits(positionAfter.debtAmount, WBTC_DECIMALS) === onChainPositionAfter.wbtcDebtAmount,
        'Borrow amount does not match',
    );
    assert(onChainPositionAfter.wbtcDebtAmount === OPEN_POSITION_BORROW, 'Borrow amount does not match on chain');
    assert(positionAfter.timestamp === (await txReceipt!.getBlock()).timestamp, 'Position block timestamp does not match');
    assert(positionAfter.blockNumber === txReceipt!.blockNumber, 'Position open block does not match');
    assert(Number(onChainPositionAfter.poistionOpenBlock) === txReceipt!.blockNumber, 'Position open block does not match on chain');
    assert(
        positionAfter.positionExpireBlock === Number(onChainPositionAfter.positionExpirationBlock),
        'Position expiration block does not match',
    );
    assert(ethers.parseUnits(positionAfter.claimableAmount, WBTC_DECIMALS) === 0n, 'Position claimable amount is not 0');
    assert(onChainPositionAfter.claimableAmount === 0n, 'Position claimable amount is not 0 on chain');
    assert(positionAfter.user === signer.address.toLowerCase(), 'Position does not belong to signer');
    try {
      // Attempt to call the ownerOf function with a non-existent token ID
      await positionToken.ownerOf(openedPosition);
      // If the above line does not throw, force the test to fail
      expect.fail('NFT ownership should have been revoked');
    } catch (error) {
      // Check that the error is a revert error and contains the expected message
      expect(error.message).to.contain('execution reverted');
      expect(error.reason).to.equal('ERC721NonexistentToken(uint256)');
    }

    const wbtcVaultBal3 = await Contracts.general.erc20(WBTC, signer).balanceOf(config.wbtcVault.toString());
    assert(wbtcVaultBal2 + OPEN_POSITION_BORROW === wbtcVaultBal3, 'WBTC vault balance incorrectly added');
  });
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
