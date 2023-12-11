import { assert } from "chai";
import "@nomicfoundation/hardhat-ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ALUSD, CURVE_POOL, FRAXBP } from "./addresses";
import helper from "./helper";
import CurvePool from "./lib/CurvePool";
import { ERC20__factory } from '../types/ethers-contracts/factories/ERC20__factory';

describe('Rebalance pool', function () {
  let signer: HardhatEthersSigner;
  let curvePool: CurvePool;

  before(async function () {
    signer = await helper.getMainSigner();
    curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);
  })

  it('Rebalance pegged curve pool', async function () {
    helper.setERC20Balance(signer.address, ALUSD, curvePool.dumpTokenBalance);

    // Unbalance the pool
    await curvePool.unbalance(25);

    // Reinit pool balances
    curvePool = await CurvePool.createInstance(signer, CURVE_POOL, ALUSD, FRAXBP);
    helper.setERC20Balance(signer.address, FRAXBP, curvePool.valueTokenBalance * 5n);

    // Assert the pool is unbalanced
    const alUSDPriceInFRAXBPBefore = await curvePool.getDumpTokenPriceInValueToken();
    assert(helper.RemoveDecimals(alUSDPriceInFRAXBPBefore, curvePool.valueTokenDecimals) < 0.75, "Pool is not unbalanced at start")

    // Rebalance the pool
    await curvePool.rebalance();

    // Assert for balanced pool
    const alUSDPriceInFRAXBPAfter = await curvePool.getDumpTokenPriceInValueToken()
    assert.approximately(helper.RemoveDecimals(alUSDPriceInFRAXBPAfter, curvePool.valueTokenDecimals), 1, 0.01, "Pool did not balance")
  });
});
