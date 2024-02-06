import {assert} from 'chai';
import '@nomicfoundation/hardhat-ethers';
import {type HardhatEthersSigner} from '@nomicfoundation/hardhat-ethers/signers';
import {ALUSD, CURVE_POOL, FRAXBP, getTokenBalancesSlot} from './lib/addresses';
import CurvePool from './lib/CurvePool';
import {EVMStorageManipulator, EthereumAddress} from '@thisisarchimedes/backend-sdk';
import {JsonRpcProvider} from 'ethers';
import {ethers} from 'hardhat';

describe('Rebalance pool', function() {
  let signer: HardhatEthersSigner;
  let curvePool: CurvePool;

  before(async function() {
    [signer] = await ethers.getSigners();
    curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);
  });

  it('Rebalance pegged curve pool', async function() {
    const evmStorage = new EVMStorageManipulator(signer.provider as JsonRpcProvider);

    const alUSDMemSlot = getTokenBalancesSlot(ALUSD.toString());
    await evmStorage.setERC20Balance(ALUSD, alUSDMemSlot.slot, new EthereumAddress(signer.address), 10n ** 36n, alUSDMemSlot.isVyper);

    // Unbalance the pool
    await curvePool.unbalance(25);

    // Reinit pool balances
    curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);
    const fraxbpMemSlot = getTokenBalancesSlot(FRAXBP.toString());
    await evmStorage.setERC20Balance(FRAXBP, fraxbpMemSlot.slot, new EthereumAddress(signer.address), 10n ** 36n, fraxbpMemSlot.isVyper);

    // Assert the pool is unbalanced
    const alUSDPriceInFRAXBPBefore = await curvePool.getDumpTokenPriceInValueToken();
    assert(Number(ethers.formatUnits(alUSDPriceInFRAXBPBefore, curvePool.valueTokenDecimals)) < 0.75, 'Pool is not unbalanced at start');

    // Rebalance the pool
    await curvePool.rebalance();

    // Assert for balanced pool
    assert.isTrue(await curvePool.adapter.underlyingBalance() > await curvePool.adapter.storedUnderlyingBalance(), 'Pool did not balance');
  });
});
