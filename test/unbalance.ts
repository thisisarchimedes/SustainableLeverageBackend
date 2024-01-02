import helper from './helper';
import CurvePool from './lib/CurvePool';
import { ALUSD, CURVE_POOL, FRAXBP } from './addresses';
import { EthereumAddress } from '@thisisarchimedes/backend-sdk';

(async () => {
  const signer = await helper.getMainSigner();
  const curvePool = await CurvePool.createInstance(signer, new EthereumAddress(CURVE_POOL), new EthereumAddress(ALUSD), new EthereumAddress(FRAXBP));

  await helper.setERC20Balance(new EthereumAddress(signer.address), new EthereumAddress(ALUSD), curvePool.dumpTokenBalance);

  // Unbalance the pool
  await curvePool.unbalance(75);

  console.log("FRAXBP", curvePool.valueTokenBalance.toString());
  console.log("ALUSD", curvePool.dumpTokenBalance.toString());
  console.log("1 ALUSD = ", await (curvePool.getDumpTokenPriceInValueToken()), "FRAXBP");
})();