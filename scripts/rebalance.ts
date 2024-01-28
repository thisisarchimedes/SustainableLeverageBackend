import CurvePool from '../test/lib/CurvePool';
import { ALUSD, CURVE_POOL, FRAXBP, getTokenBalancesSlot } from '../test/lib/addresses';
import { EVMStorageManipulator, EthereumAddress } from '@thisisarchimedes/backend-sdk';
import { JsonRpcProvider } from 'ethers';
import '@nomicfoundation/hardhat-ethers';
import { ethers } from 'hardhat';

//! FILL IN THE BALANCED POOL VALUES HERE
let FRAXBP_POOL_BALANCE = 8888310000221322953120708n;
let ALUSD_POOL_BALANCE = 31824524471010437373810902n;

(async () => {
  const [signer] = await ethers.getSigners();
  let curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);
  const evmStorage = new EVMStorageManipulator(signer.provider as JsonRpcProvider);

  // Find the right pool balance
  while (curvePool.valueTokenBalance > FRAXBP_POOL_BALANCE || curvePool.dumpTokenBalance > ALUSD_POOL_BALANCE) {
    FRAXBP_POOL_BALANCE *= 2n;
    ALUSD_POOL_BALANCE *= 2n;
  }
  
  // Fund the signer with the right amount of tokens
  const alUSDMemSlot = getTokenBalancesSlot(ALUSD.toString());
  await evmStorage.setERC20Balance(ALUSD, alUSDMemSlot.slot, new EthereumAddress(signer.address), ALUSD_POOL_BALANCE || 0n, alUSDMemSlot.isVyper);
  const fraxbpMemSlot = getTokenBalancesSlot(FRAXBP.toString());
  await evmStorage.setERC20Balance(FRAXBP, fraxbpMemSlot.slot, new EthereumAddress(signer.address), FRAXBP_POOL_BALANCE || curvePool.valueTokenBalance * 5n, fraxbpMemSlot.isVyper);

  console.log("FRAXBP", curvePool.valueTokenBalance.toString());
  console.log("ALUSD", curvePool.dumpTokenBalance.toString());
  console.log("1 ALUSD = ", await (curvePool.getDumpTokenPriceInValueToken()), "FRAXBP");
  console.log('Rebalancing...');

  // Rebalance the pool
  if (FRAXBP_POOL_BALANCE && ALUSD_POOL_BALANCE) {
    await curvePool.rebalanceToState(FRAXBP_POOL_BALANCE, ALUSD_POOL_BALANCE);
  } else {
    await curvePool.rebalance();
  }

  curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);
  console.log("FRAXBP", curvePool.valueTokenBalance.toString());
  console.log("ALUSD", curvePool.dumpTokenBalance.toString());
  console.log("1 ALUSD = ", await (curvePool.getDumpTokenPriceInValueToken()), "FRAXBP");
})();
