import { assert } from "chai";
import "@nomicfoundation/hardhat-ethers";
import { ALUSD, CURVE_POOL, FRAXBP } from "./addresses";
import helper from "./helper";
import CurvePool from "./lib/CurvePool";

describe('Unbalance pool', function () {
  let signer: any;
  let curvePool: CurvePool;

  before(async function () {
    signer = await helper.getMainSigner();
    curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);
  })

  it('Unbalance pegged curve pool', async function () {
    helper.setERC20Balance(signer.address, ALUSD, curvePool.dumpTokenBalance);

    const priceReferenceAmount = curvePool.dumpTokenBalance * 10n / 100n;
    const alUSDPriceInFRAXBPBefore = await curvePool.getDumpTokenPriceInValueToken();

    // unbalance the pool
    for (let i = 0; i < 20; i++) {
      const amountToSwap = curvePool.dumpTokenBalance * 5n / 100n
      await curvePool.exchangeDumpTokenForValueToken(amountToSwap)

      const alUSDPriceInFRAXBPAfter = await curvePool.getDumpTokenPriceInValueToken()
      const differenceInPercaentage = helper.RemoveDecimals(alUSDPriceInFRAXBPAfter, curvePool.valueTokenDecimals) / helper.RemoveDecimals(alUSDPriceInFRAXBPBefore, curvePool.valueTokenDecimals);
      if (differenceInPercaentage < 0.75) {
        break
      }
    }

    const alUSDPriceInFRAXBPAfter = await curvePool.getDumpTokenPriceInValueToken()
    assert(alUSDPriceInFRAXBPAfter < alUSDPriceInFRAXBPBefore * 75n / 100n);
  });
});
