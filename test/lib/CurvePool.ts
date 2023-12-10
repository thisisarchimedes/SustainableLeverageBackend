import { CurvePoolABI__factory } from '../../types/ethers-contracts/factories/CurvePoolABI__factory';
import { ERC20__factory } from '../../types/ethers-contracts/factories/ERC20__factory';
import { CurvePoolABI } from '../../types/ethers-contracts';
import { CURVE_POOL } from "../addresses";
import { expect, assert } from "chai";
import { ethers } from "hardhat";
import helper from "../helper";

export default class CurvePool {
  constructor(
    public readonly contractPool: CurvePoolABI,
    public readonly valueTokenIndex: number,
    public readonly dumpTokenIndex: number,
    public readonly valueTokenBalances: bigint,
    public readonly dumpTokenBalance: bigint,
    public readonly dumpTokenDecimals: number,
    public readonly valueTokenDecimals: number
  ) { }

  static async createInstance(signer: any, poolAddress: string, dumpToken: string, valueToken: string): Promise<CurvePool> {
    const pool = CurvePoolABI__factory.connect(poolAddress, signer);
    const valueTokenContract = ERC20__factory.connect(valueToken, signer)
    const dumpTokenContract = ERC20__factory.connect(dumpToken, signer)
    const valueTokenDecimals = Number(await valueTokenContract.decimals())
    const dumpTokenDecimals = Number(await dumpTokenContract.decimals())
  
    const valueTokenIndex = await helper.fetchTokenIndex(pool, valueToken);
    const dumpTokenIndex = await helper.fetchTokenIndex(pool, dumpToken)
  
    const valuetokenBalances = await pool.balances(valueTokenIndex);
    const dumpTokenBalance = await pool.balances(dumpTokenIndex)
  
    await valueTokenContract.approve(CURVE_POOL, ethers.MaxUint256)
    await dumpTokenContract.approve(CURVE_POOL, ethers.MaxUint256)
  
    return new CurvePool(pool, valueTokenIndex, dumpTokenIndex, valuetokenBalances, dumpTokenBalance, dumpTokenDecimals, valueTokenDecimals)
  }

  public async exchangeDumpTokenForValueToken(amount: bigint) {
    await this.contractPool["exchange_underlying(int128,int128,uint256,uint256)"](this.dumpTokenIndex, this.valueTokenIndex, amount, 0)
  }

  public async getDumpTokenPriceInValueToken() {
    const dumpPercentage: number = 10;

    assert.ok(dumpPercentage <= 100, "Percentage can't be higher than 100")
    // take a significant amount of dump token otherwise get a skewed price
    const priceReferenceAmount = this.dumpTokenBalance * BigInt(dumpPercentage) / 100n;
    const dumpTokenPriceInValueToken = await this.contractPool.get_dy(this.dumpTokenIndex, this.valueTokenIndex, priceReferenceAmount)

    return dumpTokenPriceInValueToken * 10n ** BigInt(this.dumpTokenDecimals) / priceReferenceAmount;
  }
}