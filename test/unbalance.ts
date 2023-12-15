import helper from './helper';
import CurvePool from './lib/CurvePool';
import { ALUSD, CURVE_POOL, FRAXBP } from './addresses';

(async () => {
  const signer = await helper.getMainSigner();
  const curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);

  await helper.setERC20Balance(signer.address, ALUSD, curvePool.dumpTokenBalance);

  console.log(curvePool.valueTokenBalance.toString());

  // Unbalance the pool
  await curvePool.unbalance(25);
})();