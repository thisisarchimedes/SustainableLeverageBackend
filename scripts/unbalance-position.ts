import CurvePool from '../test/lib/CurvePool';
import { ALUSD, CURVE_POOL, FRAXBP, getTokenBalancesSlot } from '../test/lib/addresses';
import { EVMStorageManipulator, EthereumAddress } from '@thisisarchimedes/backend-sdk';
import { JsonRpcProvider } from 'ethers';
import '@nomicfoundation/hardhat-ethers';
import { ethers } from 'hardhat';

/**
 * Runs unbalancing until by small steps
 * the specified position is eligible for liquidation
 * ensuring the specified position will have some claimable amount
 * after it is liquidated
 */

// ! FILL IN THE POSITION TO UNBALANCE
const NFT_ID = 1;

(async () => {
  const [signer] = await ethers.getSigners();
  let curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);

  const evmStorage = new EVMStorageManipulator(signer.provider as JsonRpcProvider);
  const alUSDMemSlot = getTokenBalancesSlot(ALUSD.toString());
  await evmStorage.setERC20Balance(ALUSD, alUSDMemSlot.slot, new EthereumAddress(signer.address), 10n ** 36n, alUSDMemSlot.isVyper);

  console.log("FRAXBP", curvePool.valueTokenBalance.toString());
  console.log("ALUSD", curvePool.dumpTokenBalance.toString());
  console.log("1 ALUSD = ", await (curvePool.getDumpTokenPriceInValueToken()), "FRAXBP");
  console.log('Unbalancing...');

  // Unbalance the pool
  await curvePool.unbalancePosition(NFT_ID);

  curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);
  console.log("FRAXBP", curvePool.valueTokenBalance.toString());
  console.log("ALUSD", curvePool.dumpTokenBalance.toString());
  console.log("1 ALUSD = ", await (curvePool.getDumpTokenPriceInValueToken()), "FRAXBP");
})();
