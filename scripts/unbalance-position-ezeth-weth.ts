import AuraComposableStablePool from '../test/lib/AuraComposableStablePool';
import {EZETH, EZETH_WETH_BALANCER_POOL_ID, getTokenBalancesSlot, WETH} from '../test/lib/addresses';
import {JsonRpcProvider} from 'ethers';
import '@nomicfoundation/hardhat-ethers';
import {ethers} from 'hardhat';
import EVMStorageManipulator from '../src/lib/EVMStorageManipulator';

/**
 * Runs unbalancing until by small steps
 * the specified position is eligible for liquidation
 * ensuring the specified position will have some claimable amount
 * after it is liquidated
 */

// ! FILL IN THE POSITION TO UNBALANCE
const NFT_ID = 0;

(async () => {
  const [signer] = await ethers.getSigners();
  let auraPool = await AuraComposableStablePool.createInstance(signer, EZETH_WETH_BALANCER_POOL_ID, EZETH, WETH);

  const evmStorage = new EVMStorageManipulator(signer.provider as JsonRpcProvider);
  const ezethMemSlot = getTokenBalancesSlot(EZETH);
  await evmStorage.setERC20Balance(EZETH, ezethMemSlot.slot, signer.address, 10n ** 36n, ezethMemSlot.isVyper);

  console.log('WETH', auraPool.valueTokenBalance.toString());
  console.log('EZETH', auraPool.dumpTokenBalance.toString());
  console.log('1 WETH = ', await (auraPool.getDumpTokenPriceInValueToken()), 'EZETH');
  console.log('Unbalancing...');

  // Unbalance the pool
  await auraPool.unbalancePosition(NFT_ID);

  auraPool = await AuraComposableStablePool.createInstance(signer, EZETH_WETH_BALANCER_POOL_ID, EZETH, WETH);
  console.log('WETH', auraPool.valueTokenBalance.toString());
  console.log('EZETH', auraPool.dumpTokenBalance.toString());
  console.log('1 WETH = ', await (auraPool.getDumpTokenPriceInValueToken()), 'EZETH');
})();
