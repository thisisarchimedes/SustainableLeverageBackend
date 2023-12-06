import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { CurvePoolABI__factory } from '../types/ethers-contracts/factories/CurvePoolABI__factory';
import { ERC20__factory } from '../types/ethers-contracts/factories/ERC20__factory';
import { CurvePoolABI } from '../types/ethers-contracts';
import { BigNumber } from "ethers";
import EVMStorageManipulator from "../src/lib/EVMStorageManipulator";
import helper from "./helper";

const FRAXBP = "0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC"
const ALUSD = "0xBC6DA0FE9aD5f3b0d58160288917AA56653660E9"

const CURVE_POOL = "0xB30dA2376F63De30b42dC055C93fa474F31330A5";
const PRIVATE_KEY = "0xba4ba06bdf2b4d8b3df2b415bf9e4ffdae189b18eab1246ea5617916ac0941a9";


class CurvePool {

  contractPool: CurvePoolABI;
  valueTokenIndex: number;
  dumpTokenIndex: number;
  valueTokenBalances: BigNumber;
  dumpTokenBalance: BigNumber;
  dumpTokenDecimals: number;
  valueTokenDecimals: number;


  constructor(contractPool: CurvePoolABI, valueTokenIndex: number, dumpTokenIndex: number, valueTokenBalances: BigNumber, dumpTokenBalance: BigNumber, dumpTokenDecimals: number, valueTokenDecimals: number) {
    this.contractPool = contractPool
    this.valueTokenIndex = valueTokenIndex
    this.dumpTokenIndex = dumpTokenIndex
    this.valueTokenBalances = valueTokenBalances
    this.dumpTokenBalance = dumpTokenBalance
    this.dumpTokenDecimals = dumpTokenDecimals
    this.valueTokenDecimals = valueTokenDecimals
  }

  public async exchangeDumpTokenForValueToken(amount: BigNumber) {
    console.log("exchangeDumpTokenForValueToken", amount.toString())
    console.log("dumpTokenIndex", this.dumpTokenIndex.toString())
    console.log("valueTokenIndex", this.valueTokenIndex.toString())
    console.log("dumpTokenBalance", this.dumpTokenBalance.toString())

   await this.contractPool["exchange_underlying(int128,int128,uint256,uint256)"](this.dumpTokenIndex, this.valueTokenIndex, amount, 0)
  }
  
  public async getDumpTokenPriceInValueToken() {
    const dumpPercentage: number = 10;

    assert.ok(dumpPercentage <= 100, "Percentage can't be higher than 100")
    // take a significant amount of dump token otherwise get a skewed price
    const priceReferenceAmount = this.dumpTokenBalance.mul(dumpPercentage).div(100)
    const dumpTokenPriceInValueToken = await this.contractPool.get_dy(this.dumpTokenIndex, this.valueTokenIndex, priceReferenceAmount)

    return dumpTokenPriceInValueToken.mul(BigNumber.from(10).pow(this.dumpTokenDecimals)).div(priceReferenceAmount);
  }

}

async function initCurvePool(signer: any, poolAddress: string, dumpToken: string, valueToken: string): Promise<CurvePool> {
  const pool = CurvePoolABI__factory.connect(poolAddress, signer);
  const valueTokenContract = ERC20__factory.connect(valueToken, signer)
  const dumpTokenContract = ERC20__factory.connect(dumpToken, signer)
  const valueTokenDecimals = await valueTokenContract.decimals()
  const dumpTokenDecimals = await dumpTokenContract.decimals()

  const valueTokenIndex = await helper.fetchTokenIndex(pool, valueToken);
  const dumpTokenIndex = await helper.fetchTokenIndex(pool, dumpToken)

  const valuetokenBalances = await pool.balances(valueTokenIndex);
  const dumpTokenBalance = await pool.balances(dumpTokenIndex)

  await valueTokenContract.approve(CURVE_POOL, ethers.constants.MaxUint256)
  await dumpTokenContract.approve(CURVE_POOL, ethers.constants.MaxUint256)

  return new CurvePool(pool, valueTokenIndex, dumpTokenIndex, valuetokenBalances, dumpTokenBalance, dumpTokenDecimals, valueTokenDecimals)
}


describe('Unbalance pool', function () {
  let signer: any;
  let curvePool: CurvePool;
  before(async function () {


    signer = await helper.getMainSigner();
    curvePool = await initCurvePool(signer, CURVE_POOL, ALUSD, FRAXBP);

  })

  it('Unbalance pegged curve pool', async function () {

    helper.setERC20Balance(signer.address, ALUSD, curvePool.dumpTokenBalance);

    const priceReferenceAmount = curvePool.dumpTokenBalance.mul(10).div(100)
    const alUSDPriceInFRAXBPBefore = await curvePool.getDumpTokenPriceInValueToken();

    // unbalance the pool
    for (let i = 0; i < 20; i++) {

      const amountToSwap = curvePool.dumpTokenBalance.mul(5).div(100)
      await curvePool.exchangeDumpTokenForValueToken(amountToSwap)

      const alUSDPriceInFRAXBPAfter = await curvePool.getDumpTokenPriceInValueToken()
      const differenceInPercaentage = helper.RemoveDecimals(alUSDPriceInFRAXBPAfter, curvePool.valueTokenDecimals) / helper.RemoveDecimals(alUSDPriceInFRAXBPBefore, curvePool.valueTokenDecimals);
      if (differenceInPercaentage < 0.75) {
        break
      }
    }

    const alUSDPriceInFRAXBPAfter = await curvePool.getDumpTokenPriceInValueToken()
    assert.ok(alUSDPriceInFRAXBPAfter.lt(alUSDPriceInFRAXBPBefore.mul(75).div(100)));
  });
});
