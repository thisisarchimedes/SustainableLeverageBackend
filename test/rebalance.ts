import helper from './helper';
import CurvePool from './lib/CurvePool';
import { ALUSD, CURVE_POOL, FRAXBP } from './addresses';

(async () => {
  const signer = await helper.getMainSigner();
  const curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);

  await helper.setERC20Balance(signer.address, FRAXBP, curvePool.valueTokenBalance * 5n);
  
  // Rebalance the pool
  await curvePool.rebalance();

  console.log("FRAXBP", curvePool.valueTokenBalance.toString());
  console.log("ALUSD", curvePool.dumpTokenBalance.toString());
  console.log("1 ALUSD = ", await (curvePool.getDumpTokenPriceInValueToken()), "FRAXBP");
})();
