import {type HardhatEthersSigner} from '@nomicfoundation/hardhat-ethers/signers';
import {CURVE_POOL} from './addresses';
import {assert} from 'chai';
import {ethers} from 'hardhat';
import {Contracts, EthereumAddress, CurvePool as CurvePoolContract} from '@thisisarchimedes/backend-sdk';

export default class CurvePool {
  //* Public methods *//

  static async createInstance(signer: HardhatEthersSigner,
      poolAddress: EthereumAddress, dumpToken: EthereumAddress, valueToken: EthereumAddress): Promise<CurvePool> {
    const pool = Contracts.general.curvePool(poolAddress, signer);
    // eslint-disable-next-line new-cap
    const valueTokenContract = Contracts.general.ERC20(valueToken, signer);
    // eslint-disable-next-line new-cap
    const dumpTokenContract = Contracts.general.ERC20(dumpToken, signer);
    const valueTokenDecimals = Number(await valueTokenContract.decimals());
    const dumpTokenDecimals = Number(await dumpTokenContract.decimals());

    const valueTokenIndex = await CurvePool.fetchTokenIndex(pool, valueToken);
    const dumpTokenIndex = await CurvePool.fetchTokenIndex(pool, dumpToken);

    const valuetokenBalance = await pool.balances(valueTokenIndex);
    const dumpTokenBalance = await pool.balances(dumpTokenIndex);

    await valueTokenContract.approve(CURVE_POOL.toString(), ethers.MaxUint256);
    await dumpTokenContract.approve(CURVE_POOL.toString(), ethers.MaxUint256);

    return new CurvePool(pool, valueTokenIndex, dumpTokenIndex,
        valuetokenBalance, dumpTokenBalance, dumpTokenDecimals, valueTokenDecimals);
  }

  constructor(
    public readonly contractPool: CurvePoolContract,
    public readonly valueTokenIndex: number,
    public readonly dumpTokenIndex: number,
    public readonly valueTokenBalance: bigint,
    public readonly dumpTokenBalance: bigint,
    public readonly dumpTokenDecimals: number,
    public readonly valueTokenDecimals: number,
  ) { }

  public async exchangeDumpTokenForValueToken(amount: bigint): Promise<void> {
    await this.contractPool['exchange_underlying(int128,int128,uint256,uint256)'](this.dumpTokenIndex,
        this.valueTokenIndex, amount, 0);
  }

  public async exchangeValueTokenForDumpToken(amount: bigint): Promise<void> {
    await this.contractPool['exchange(int128,int128,uint256,uint256)'](this.valueTokenIndex,
        this.dumpTokenIndex, amount, 0);
  }

  public async getDumpTokenPriceInValueToken(dumpPercentage = 10): Promise<bigint> {
    assert.ok(dumpPercentage <= 100, 'Percentage can\'t be higher than 100');
    // Take a significant amount of dump token otherwise get a skewed price
    const priceReferenceAmount = this.dumpTokenBalance * BigInt(dumpPercentage) / 10000n; // 0.1%
    const dumpTokenPriceInValueToken = await this.contractPool.get_dy(this.dumpTokenIndex,
        this.valueTokenIndex, priceReferenceAmount);

    return dumpTokenPriceInValueToken * (10n ** BigInt(this.dumpTokenDecimals)) / priceReferenceAmount;
  }

  public async rebalance(): Promise<void> {
    const amountToSwap = this.valueTokenBalance * 5n / 100n;

    for (let i = 0; i < 1000; i++) {
      // eslint-disable-next-line no-await-in-loop
      await this.exchangeValueTokenForDumpToken(amountToSwap);

      // eslint-disable-next-line no-await-in-loop
      const alUSDPriceInFRAXBPAfter = await this.getDumpTokenPriceInValueToken();
      if (Number(ethers.formatUnits(alUSDPriceInFRAXBPAfter, this.valueTokenDecimals)) >= 0.99 &&
          Number(ethers.formatUnits(alUSDPriceInFRAXBPAfter, this.valueTokenDecimals)) <= 1.01) {
        break;
      }
    }
  }

  public async unbalance(percentToUnbalance: number): Promise<void> {
    assert.ok(percentToUnbalance <= 100, 'Percentage can\'t be higher than 100');

    const amountToSwap = this.dumpTokenBalance * 5n / 100n;

    for (let i = 0; i < 100; i++) {
      // eslint-disable-next-line no-await-in-loop
      await this.exchangeDumpTokenForValueToken(amountToSwap);

      // eslint-disable-next-line no-await-in-loop
      const alUSDPriceInFRAXBPAfter = await this.getDumpTokenPriceInValueToken();
      if (Number(ethers.formatUnits(alUSDPriceInFRAXBPAfter, this.valueTokenDecimals))<1 - (percentToUnbalance / 100)) {
        break;
      }
    }
  }

  //* Private methods *//

  private static async fetchTokenIndex(pool: CurvePoolContract, token: EthereumAddress): Promise<number> {
    let tokenIndex = 0;
    for (let i = 0; i < 4; i++) {
      // eslint-disable-next-line no-await-in-loop
      const _token = await pool.coins(i);
      if (_token === token.toString()) {
        tokenIndex = i;
        break;
      }
    }

    return Number(tokenIndex);
  }
}
