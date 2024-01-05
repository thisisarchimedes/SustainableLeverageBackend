import CurvePool from './lib/CurvePool';
import { ALUSD, CURVE_POOL, FRAXBP, getTokenBalancesSlot } from './addresses';
import { EVMStorageManipulator, EthereumAddress } from '@thisisarchimedes/backend-sdk';
import { JsonRpcProvider } from 'ethers';
import { ethers } from 'hardhat';

(async () => {
  const [signer] = await ethers.getSigners();
  const curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);

  const evmStorage = new EVMStorageManipulator(signer.provider as JsonRpcProvider);
  const alUSDMemSlot = getTokenBalancesSlot(ALUSD.toString());
  await evmStorage.setERC20Balance(ALUSD, alUSDMemSlot.slot, new EthereumAddress(signer.address), curvePool.dumpTokenBalance, alUSDMemSlot.isVyper);

  // Unbalance the pool
  await curvePool.unbalance(75);

  console.log("FRAXBP", curvePool.valueTokenBalance.toString());
  console.log("ALUSD", curvePool.dumpTokenBalance.toString());
  console.log("1 ALUSD = ", await (curvePool.getDumpTokenPriceInValueToken()), "FRAXBP");
})();