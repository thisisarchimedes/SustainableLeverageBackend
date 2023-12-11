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
    helper.setERC20Balance(signer.address, FRAXBP, curvePool.valueTokenBalance * 5n);
    
    // Rebalance the pool
    await curvePool.rebalance();
    
    // Reinit pool balances
    curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);
    helper.setERC20Balance(signer.address, ALUSD, curvePool.dumpTokenBalance);

    // Assert the pool is roughly balanced
    const alUSDPriceInFRAXBPBefore = await curvePool.getDumpTokenPriceInValueToken()
    assert.approximately(helper.RemoveDecimals(alUSDPriceInFRAXBPBefore, curvePool.valueTokenDecimals), 1, 0.01, "Pool is not balanced at start")

    // Unbalance the pool
    await curvePool.unbalance(25);

    // Assert for unbalanced pool
    const alUSDPriceInFRAXBPAfter = await curvePool.getDumpTokenPriceInValueToken()
    assert(helper.RemoveDecimals(alUSDPriceInFRAXBPAfter, curvePool.valueTokenDecimals) < 0.75, "Pool is not unbalanced enough");
  });
});
