import {assert} from 'chai';
import '@nomicfoundation/hardhat-ethers';
import {ethers} from 'hardhat';
import {JsonRpcProvider} from 'ethers';
import {type HardhatEthersSigner} from '@nomicfoundation/hardhat-ethers/signers';
import {EVMStorageManipulator, EthereumAddress} from '@thisisarchimedes/backend-sdk';
import {ALUSD, CURVE_POOL, FRAXBP, getTokenBalancesSlot} from './lib/addresses';
import CurvePool from './lib/CurvePool';

// eslint-disable-next-line mocha/no-skipped-tests
describe.skip('Unbalance pool', function() {
  let signer: HardhatEthersSigner;
  let curvePool: CurvePool;

  before(async function() {
    [signer] = await ethers.getSigners();
  });

  beforeEach(async function() {
    curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);
  });

  it('Unbalance pegged curve pool', async function() {
    const evmStorage = new EVMStorageManipulator(signer.provider as JsonRpcProvider);

    const fraxbpMemSlot = getTokenBalancesSlot(FRAXBP.toString());
    await evmStorage.setERC20Balance(FRAXBP, fraxbpMemSlot.slot, new EthereumAddress(signer.address), 10n ** 36n, fraxbpMemSlot.isVyper);

    // Rebalance the pool
    await curvePool.rebalance();

    // Reinit pool balances
    curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);
    const alUSDMemSlot = getTokenBalancesSlot(ALUSD.toString());
    await evmStorage.setERC20Balance(ALUSD, alUSDMemSlot.slot, new EthereumAddress(signer.address), 10n ** 36n, alUSDMemSlot.isVyper);

    // Assert the pool is roughly balanced
    assert.isTrue(
        await curvePool.adapter.underlyingBalance() >
      await curvePool.adapter.storedUnderlyingBalance(),
        'Pool is not balanced at start',
    );

    // Unbalance the pool
    await curvePool.unbalance(25);

    // Assert for unbalanced pool
    const alUSDPriceInFRAXBPAfter = await curvePool.getDumpTokenPriceInValueToken();
    assert(Number(ethers.formatUnits(alUSDPriceInFRAXBPAfter,
        curvePool.valueTokenDecimals)) < 0.75, 'Pool is not unbalanced enough');
  });
});
