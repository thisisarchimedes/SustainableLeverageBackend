import {type HardhatEthersSigner} from '@nomicfoundation/hardhat-ethers/signers';
import {CURVE_POOL, CURVE_POOL_ADAPTER, EZETH_WETH_AURA_POOL, EZETH_WETH_AURA_POOL_ADAPTER, LEVERAGED_STRATEGY} from './addresses';
import {assert} from 'chai';
import {ethers} from 'hardhat';
import {Contracts,
  EthereumAddress,
  CurvePool as CurvePoolContract,
  ConvexPoolAdapter,
  LeveragedStrategy,
} from '@thisisarchimedes/backend-sdk';

export default class AuraComposableStablePool {
  //* Public methods *//

  static async createInstance(
      signer: HardhatEthersSigner,
      poolAddress: EthereumAddress,
      dumpToken: EthereumAddress,
      valueToken: EthereumAddress,
  ): Promise<AuraComposableStablePool> {
    const leveragedStrategy = Contracts.leverage.leveragedStrategy(LEVERAGED_STRATEGY, signer);
    const pool = Contracts.general.auraComposableStablePool(poolAddress, signer);
    const adapter = Contracts.general.auraComposableStablePoolAdapter(EZETH_WETH_AURA_POOL_ADAPTER, signer);
    const valueTokenContract = Contracts.general.erc20(valueToken, signer);
    // eslint-disable-next-line new-cap
    const dumpTokenContract = Contracts.general.erc20(dumpToken, signer);
    const valueTokenDecimals = Number(await valueTokenContract.decimals());
    const dumpTokenDecimals = Number(await dumpTokenContract.decimals());

    const valueTokenIndex = await AuraComposableStablePool.fetchTokenIndex(pool, valueToken);
    const dumpTokenIndex = await AuraComposableStablePool.fetchTokenIndex(pool, dumpToken);

    const valueTokenInitialBalance = await pool.balances(valueTokenIndex);
    const dumpTokenInitialBalance = await pool.balances(dumpTokenIndex);

    await valueTokenContract.approve(EZETH_WETH_AURA_POOL.toString(), ethers.MaxUint256);
    await dumpTokenContract.approve(EZETH_WETH_AURA_POOL.toString(), ethers.MaxUint256);

    return new AuraComposableStablePool(
        leveragedStrategy,
        pool,
        adapter,
        valueTokenIndex,
        dumpTokenIndex,
        valueTokenInitialBalance,
        dumpTokenInitialBalance,
        dumpTokenDecimals,
        valueTokenDecimals,
    );
  }

  constructor(
    public readonly leveragedStrategy: LeveragedStrategy,
    public readonly contractPool: CurvePoolContract,
    public readonly adapter: ConvexPoolAdapter,
    public readonly valueTokenIndex: number,
    public readonly dumpTokenIndex: number,
    public readonly valueTokenInitialBalance: bigint,
    public readonly dumpTokenInitialBalance: bigint,
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
    const priceReferenceAmount = this.dumpTokenInitialBalance * BigInt(dumpPercentage) / 10000n; // 0.1%
    const dumpTokenPriceInValueToken = await this.contractPool.get_dy(this.dumpTokenIndex,
        this.valueTokenIndex, priceReferenceAmount);

    return dumpTokenPriceInValueToken * (10n ** BigInt(this.dumpTokenDecimals)) / priceReferenceAmount;
  }

  public async rebalance(): Promise<void> {
    const amountToSwap = this.valueTokenInitialBalance * 20n / 100n;

    for (let i = 0; i < 1000; i++) {
      console.log(await this.adapter.underlyingBalance(), await this.adapter.storedUnderlyingBalance()); // Debug
      if (await this.adapter.underlyingBalance() > await this.adapter.storedUnderlyingBalance()) {
        break;
      }

      // eslint-disable-next-line no-await-in-loop
      await this.exchangeValueTokenForDumpToken(amountToSwap);
    }
  }

  public async unbalancePosition(nftId: number): Promise<void> {
    const amountToSwap = this.dumpTokenInitialBalance / 100n;

    for (let i = 0; i < 100; i++) {
      try {
        if (await this.leveragedStrategy.isPositionLiquidatableEstimation(nftId)) {
          console.log(`Position ${nftId} is liquidatable`);
          break;
        }

        // eslint-disable-next-line no-await-in-loop
        await this.exchangeDumpTokenForValueToken(amountToSwap);
        console.log(await this.contractPool.balances(this.valueTokenIndex), await this.contractPool.balances(this.dumpTokenIndex)); // Debug
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (error.data.data === '0x5117a49b') { // PositionNotLive
          console.error(`Position ${nftId} is not live`);
          return;
        } else if (error.data !== '0x5e6797f9') { // NotEligibleForLiquidation - skip
          console.error(`Position ${nftId} isPositionLiquidatableEstimation errored with:`, error);
          return;
        }
      }
    }
  }

  public async unbalance(percentToUnbalance: number): Promise<void> {
    assert.ok(percentToUnbalance <= 100, 'Percentage can\'t be higher than 100');

    const amountToSwap = this.dumpTokenInitialBalance * 5n / 100n;

    for (let i = 0; i < 100; i++) {
      // eslint-disable-next-line no-await-in-loop
      await this.exchangeDumpTokenForValueToken(amountToSwap);

      // eslint-disable-next-line no-await-in-loop
      const alUSDPriceInFRAXBPAfter = await this.getDumpTokenPriceInValueToken();
      console.log(await this.contractPool.balances(this.valueTokenIndex), await this.contractPool.balances(this.dumpTokenIndex)); // Debug
      if (Number(ethers.formatUnits(alUSDPriceInFRAXBPAfter, this.valueTokenDecimals)) < 1 - (percentToUnbalance / 100)) {
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
