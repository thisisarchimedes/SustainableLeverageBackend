import CurvePool from '../test/lib/CurvePool';
import {ALUSD, CURVE_POOL, FRAXBP, getTokenBalancesSlot} from '../test/lib/addresses';
import {EVMStorageManipulator, EthereumAddress} from '@thisisarchimedes/backend-sdk';
import {JsonRpcProvider} from 'ethers';
import '@nomicfoundation/hardhat-ethers';
import {ethers} from 'hardhat';

(async () => {
  const [signer] = await ethers.getSigners();
  const curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);
  const evmStorage = new EVMStorageManipulator(signer.provider as JsonRpcProvider);

  const fraxbpMemSlot = getTokenBalancesSlot(FRAXBP.toString());
  await evmStorage.setERC20Balance(FRAXBP, fraxbpMemSlot.slot,
      new EthereumAddress(signer.address), curvePool.valueTokenBalance * 5n, fraxbpMemSlot.isVyper);

  // Rebalance the pool
  await curvePool.rebalance();

  console.log('FRAXBP', curvePool.valueTokenBalance.toString());
  console.log('ALUSD', curvePool.dumpTokenBalance.toString());
  console.log('1 ALUSD = ', await (curvePool.getDumpTokenPriceInValueToken()), 'FRAXBP');
})();
