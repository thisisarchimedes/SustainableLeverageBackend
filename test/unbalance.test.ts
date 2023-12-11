import { assert } from "chai";
import "@nomicfoundation/hardhat-ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ALUSD, CURVE_POOL, FRAXBP } from "./addresses";
import helper from "./helper";
import CurvePool from "./lib/CurvePool";

describe('Unbalance pool', function () {
  let signer: HardhatEthersSigner;
  let curvePool: CurvePool;

  before(async function () {
    signer = await helper.getMainSigner();
    curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);
  })

  it('Unbalance pegged curve pool', async function () {
    helper.setERC20Balance(signer.address, ALUSD, curvePool.dumpTokenBalance);

    // TODO: balance

    // Assert the pool is roughly balanced
    const alUSDPriceInFRAXBPBefore = await curvePool.getDumpTokenPriceInValueToken()
    assert.approximately(helper.RemoveDecimals(alUSDPriceInFRAXBPBefore, curvePool.valueTokenDecimals), 1, 0.01, "Pool is not balanced at start")

    // unbalance the pool
    curvePool.unbalance(25);

    const alUSDPriceInFRAXBPAfter = await curvePool.getDumpTokenPriceInValueToken()
    // assert(alUSDPriceInFRAXBPAfter < alUSDPriceInFRAXBPBefore * 75n / 100n); // TODO: remove after rebalanced

    assert(helper.RemoveDecimals(alUSDPriceInFRAXBPAfter, curvePool.valueTokenDecimals) < 0.75, "Pool is not unbalanced enough");
  });
});
