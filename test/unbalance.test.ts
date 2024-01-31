import {assert} from 'chai';
import '@nomicfoundation/hardhat-ethers';
import {type HardhatEthersSigner} from '@nomicfoundation/hardhat-ethers/signers';
import {ALUSD, CURVE_POOL, FRAXBP, getTokenBalancesSlot} from './lib/addresses';
import CurvePool from './lib/CurvePool';
import {EVMStorageManipulator, EthereumAddress} from '@thisisarchimedes/backend-sdk';
import {JsonRpcProvider} from 'ethers';
import {ethers} from 'hardhat';

describe('Unbalance pool', function() {
  let signer: HardhatEthersSigner;
  let curvePool: CurvePool;

  before(async function() {
    [signer] = await ethers.getSigners();
    curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);
  });

  it('Unbalance pegged curve pool', async function() {
    const evmStorage = new EVMStorageManipulator(signer.provider as JsonRpcProvider);

    const fraxbpMemSlot = getTokenBalancesSlot(FRAXBP.toString());
    await evmStorage.setERC20Balance(FRAXBP,
        fraxbpMemSlot.slot, new EthereumAddress(signer.address),
        curvePool.valueTokenBalance * 5n, fraxbpMemSlot.isVyper);

    // Rebalance the pool
    await curvePool.rebalance();

    // Reinit pool balances
    curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);
    const alUSDMemSlot = getTokenBalancesSlot(ALUSD.toString());
    await evmStorage.setERC20Balance(ALUSD,
        alUSDMemSlot.slot, new EthereumAddress(signer.address),
        curvePool.dumpTokenBalance, alUSDMemSlot.isVyper);

    // Assert the pool is roughly balanced
    const alUSDPriceInFRAXBPBefore = await curvePool.getDumpTokenPriceInValueToken();
    assert.approximately(Number(ethers.formatUnits(alUSDPriceInFRAXBPBefore,
        curvePool.valueTokenDecimals)), 1, 0.01, 'Pool is not balanced at start');

    // Unbalance the pool
    await curvePool.unbalance(25);

    // Assert for unbalanced pool
    const alUSDPriceInFRAXBPAfter = await curvePool.getDumpTokenPriceInValueToken();
    assert(Number(ethers.formatUnits(alUSDPriceInFRAXBPAfter,
        curvePool.valueTokenDecimals)) < 0.75, 'Pool is not unbalanced enough');
  });
});
