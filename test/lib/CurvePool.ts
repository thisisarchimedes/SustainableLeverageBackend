import { CurvePoolABI__factory } from '../../types/ethers-contracts/factories/CurvePoolABI__factory';
import { ERC20__factory } from '../../types/ethers-contracts/factories/ERC20__factory';
import { type HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { type CurvePoolABI } from '../../types/ethers-contracts/CurvePoolABI';
import { CURVE_POOL } from '../addresses';
import { assert } from 'chai';
import { ethers } from 'hardhat';
import helper from '../helper';

export default class CurvePool {
  static async createInstance(signer: HardhatEthersSigner, poolAddress: string, dumpToken: string, valueToken: string): Promise<CurvePool> {
    const pool = CurvePoolABI__factory.connect(poolAddress, signer);
    const valueTokenContract = ERC20__factory.connect(valueToken, signer);
    const dumpTokenContract = ERC20__factory.connect(dumpToken, signer);
    const valueTokenDecimals = Number(await valueTokenContract.decimals());
    const dumpTokenDecimals = Number(await dumpTokenContract.decimals());

    const valueTokenIndex = await helper.fetchTokenIndex(pool, valueToken);
    const dumpTokenIndex = await helper.fetchTokenIndex(pool, dumpToken);

    const valuetokenBalance = await pool.balances(valueTokenIndex);
    const dumpTokenBalance = await pool.balances(dumpTokenIndex);

    await valueTokenContract.approve(CURVE_POOL, ethers.MaxUint256);
    await dumpTokenContract.approve(CURVE_POOL, ethers.MaxUint256);

    return new CurvePool(pool, valueTokenIndex, dumpTokenIndex, valuetokenBalance, dumpTokenBalance, dumpTokenDecimals, valueTokenDecimals);
  }

  constructor(
    public readonly contractPool: CurvePoolABI,
    public readonly valueTokenIndex: number,
    public readonly dumpTokenIndex: number,
    public readonly valueTokenBalance: bigint,
    public readonly dumpTokenBalance: bigint,
    public readonly dumpTokenDecimals: number,
    public readonly valueTokenDecimals: number,
  ) { }

  public async exchangeDumpTokenForValueToken(amount: bigint): Promise<void> {
    await this.contractPool['exchange_underlying(int128,int128,uint256,uint256)'](this.dumpTokenIndex, this.valueTokenIndex, amount, 0);
  }

  public async exchangeValueTokenForDumpToken(amount: bigint): Promise<void> {
    await this.contractPool['exchange(int128,int128,uint256,uint256)'](this.valueTokenIndex, this.dumpTokenIndex, amount, 0);
  }

  public async getDumpTokenPriceInValueToken(dumpPercentage = 10): Promise<bigint> {
    assert.ok(dumpPercentage <= 100, 'Percentage can\'t be higher than 100');
    // Take a significant amount of dump token otherwise get a skewed price
    const priceReferenceAmount = this.dumpTokenBalance * BigInt(dumpPercentage) / 100n;
    const dumpTokenPriceInValueToken = await this.contractPool.get_dy(this.dumpTokenIndex, this.valueTokenIndex, priceReferenceAmount);

    return dumpTokenPriceInValueToken * (10n ** BigInt(this.dumpTokenDecimals)) / priceReferenceAmount;
  }

  public async rebalance(): Promise<void> {
    const amountToSwap = this.valueTokenBalance * 5n / 100n;

    for (let i = 0; i < 100; i++) {
      // eslint-disable-next-line no-await-in-loop
      await this.exchangeValueTokenForDumpToken(amountToSwap);

      // eslint-disable-next-line no-await-in-loop
      const alUSDPriceInFRAXBPAfter = await this.getDumpTokenPriceInValueToken();
      // Console.log("alUSDPriceInFRAXBPAfter", helper.removeDecimals(alUSDPriceInFRAXBPAfter, this.valueTokenDecimals)) // Debug
      if (helper.removeDecimals(alUSDPriceInFRAXBPAfter, this.valueTokenDecimals) >= 0.99 && helper.removeDecimals(alUSDPriceInFRAXBPAfter, this.valueTokenDecimals) <= 1.01) {
        break;
      }
    }
  }

  public async unbalance(percentToUnbalance: number): Promise<void> {
    assert.ok(percentToUnbalance <= 100, 'Percentage can\'t be higher than 100');

    const amountToSwap = this.dumpTokenBalance * 5n / 100n;

    for (let i = 0; i < 20; i++) {
      // eslint-disable-next-line no-await-in-loop
      await this.exchangeDumpTokenForValueToken(amountToSwap);

      // eslint-disable-next-line no-await-in-loop
      const alUSDPriceInFRAXBPAfter = await this.getDumpTokenPriceInValueToken();
      // Console.log("alUSDPriceInFRAXBPAfter", helper.removeDecimals(alUSDPriceInFRAXBPAfter, this.valueTokenDecimals)) // Debug
      if (helper.removeDecimals(alUSDPriceInFRAXBPAfter, this.valueTokenDecimals) < 1 - (percentToUnbalance / 100)) {
        break;
      }
    }
  }
}
