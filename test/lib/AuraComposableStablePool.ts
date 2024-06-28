import {type HardhatEthersSigner} from '@nomicfoundation/hardhat-ethers/signers';
import {BALANCER_VAULT, EZETH_WETH_AURA_POOL, EZETH_WETH_AURA_POOL_ADAPTER, LEVERAGED_STRATEGY} from './addresses';
import {assert} from 'chai';
import {ethers} from 'hardhat';
import {LeveragedStrategy__factory} from '../../src/types/leverage-contracts/factories/LeveragedStrategy__factory';
import {AuraComposableStablePool__factory} from '../../src/types/leverage-contracts/factories/AuraComposableStablePool__factory';
import {BalancerVault__factory} from '../../src/types/leverage-contracts/factories/BalancerVault__factory';
import {AuraComposableStablePoolAdapter__factory}
  from '../../src/types/leverage-contracts/factories/AuraComposableStablePoolAdapter__factory';
import {ERC20__factory} from '../../src/types/leverage-contracts/factories/ERC20__factory';
import {LeveragedStrategy} from '../../src/types/leverage-contracts/LeveragedStrategy';
import {AuraComposableStablePool as AuraComposableStablePoolContract} from '../../src/types/leverage-contracts/AuraComposableStablePool';
import {BalancerVault as BalancerVaultContract, IVault} from '../../src/types/leverage-contracts/BalancerVault';
import {AuraComposableStablePoolAdapter} from '../../src/types/leverage-contracts/AuraComposableStablePoolAdapter';

export default class AuraCompotableStablePool {
  //* Public methods *//

  static async createInstance(
      signer: HardhatEthersSigner,
      poolId: string,
      dumpToken: string,
      valueToken: string,
  ): Promise<AuraCompotableStablePool> {
    const leveragedStrategy = LeveragedStrategy__factory.connect(LEVERAGED_STRATEGY, signer);
    const vault = BalancerVault__factory.connect(BALANCER_VAULT, signer);
    const adapter = AuraComposableStablePoolAdapter__factory.connect(EZETH_WETH_AURA_POOL_ADAPTER, signer);

    const valueTokenContract = ERC20__factory.connect(valueToken, signer);
    const dumpTokenContract = ERC20__factory.connect(dumpToken, signer);

    const valueTokenDecimals = Number(await valueTokenContract.decimals());
    const dumpTokenDecimals = Number(await dumpTokenContract.decimals());

    const valueTokenIndex = await AuraCompotableStablePool.fetchTokenIndex(vault, poolId, valueToken);
    const dumpTokenIndex = await AuraCompotableStablePool.fetchTokenIndex(vault, poolId, dumpToken);

    const valuetokenBalance = await AuraCompotableStablePool.fetchTokenBalance(vault, poolId, valueTokenIndex);
    const dumpTokenBalance = await AuraCompotableStablePool.fetchTokenBalance(vault, poolId, dumpTokenIndex);

    await valueTokenContract.approve(BALANCER_VAULT, ethers.MaxUint256);
    await dumpTokenContract.approve(BALANCER_VAULT, ethers.MaxUint256);

    return new AuraCompotableStablePool(
        leveragedStrategy,
        vault,
        adapter,
        valueToken,
        dumpToken,
        valueTokenIndex,
        dumpTokenIndex,
        valuetokenBalance,
        dumpTokenBalance,
        dumpTokenDecimals,
        valueTokenDecimals,
        AuraComposableStablePool__factory.connect(EZETH_WETH_AURA_POOL, signer),
        poolId,
        signer.address,
    );
  }

  constructor(
    public readonly leveragedStrategy: LeveragedStrategy,
    public readonly vault: BalancerVaultContract,
    public readonly adapter: AuraComposableStablePoolAdapter,
    public readonly valueToken: string,
    public readonly dumpToken: string,
    public readonly valueTokenIndex: number,
    public readonly dumpTokenIndex: number,
    public readonly valueTokenBalance: bigint,
    public readonly dumpTokenBalance: bigint,
    public readonly dumpTokenDecimals: number,
    public readonly valueTokenDecimals: number,
    public readonly pool: AuraComposableStablePoolContract,
    public readonly poolId: string,
    public readonly signerAddress: string,
  ) { }

  public async exchangeDumpTokenForValueToken(amount: bigint): Promise<void> {
    const singleSwap: IVault.SingleSwapStruct = {
      poolId: this.poolId,
      kind: 0, // GIVEN_IN
      assetIn: this.dumpToken,
      assetOut: this.valueToken,
      amount: amount,
      userData: '0x',
    };

    const fundManagement: IVault.FundManagementStruct = {
      sender: this.signerAddress,
      fromInternalBalance: false,
      recipient: this.signerAddress,
      toInternalBalance: false,
    };

    await this.vault.swap(
        singleSwap,
        fundManagement,
        0,
        Math.floor(new Date().getTime() / 1000 + 3600),
    );
  }

  public async exchangeValueTokenForDumpToken(amount: bigint): Promise<void> {
    const singleSwap: IVault.SingleSwapStruct = {
      poolId: this.poolId,
      kind: 0, // GIVEN_IN
      assetOut: this.valueToken,
      assetIn: this.dumpToken,
      amount: amount,
      userData: '0x',
    };

    const fundManagement: IVault.FundManagementStruct = {
      sender: this.signerAddress,
      fromInternalBalance: false,
      recipient: this.signerAddress,
      toInternalBalance: false,
    };

    await this.vault.swap(
        singleSwap,
        fundManagement,
        0,
        Math.floor(new Date().getTime() / 1000 + 3600),
    );
  }

  public async getDumpTokenPriceInValueToken(dumpPercentage = 10): Promise<bigint> {
    assert.ok(dumpPercentage <= 100, 'Percentage can\'t be higher than 100');
    // Take a significant amount of dump token otherwise get a skewed price
    const priceReferenceAmount = this.dumpTokenBalance * BigInt(dumpPercentage) / 10000n; // 0.1%

    const dumpTokenPriceInValueToken = await this.pool.getTokenRate(this.dumpToken) / await this.pool.getTokenRate(this.valueToken);

    return dumpTokenPriceInValueToken * (10n ** BigInt(this.dumpTokenDecimals)) / priceReferenceAmount;
  }

  public async rebalance(): Promise<void> {
    const amountToSwap = this.valueTokenBalance * 20n / 100n;

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
    const amountToSwap = this.dumpTokenBalance / 100n;

    for (let i = 0; i < 100; i++) {
      try {
        if (await this.leveragedStrategy.isPositionLiquidatableEstimation(nftId)) {
          console.log(`Position ${nftId} is liquidatable`);
          break;
        }

        // eslint-disable-next-line no-await-in-loop
        await this.exchangeDumpTokenForValueToken(amountToSwap);
        console.log(
            await AuraCompotableStablePool.fetchTokenBalance(this.vault, this.poolId, this.valueTokenIndex),
            await AuraCompotableStablePool.fetchTokenBalance(this.vault, this.poolId, this.dumpTokenIndex),
        ); // Debug
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.log(error);
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

    const amountToSwap = this.dumpTokenBalance * 5n / 100n;

    for (let i = 0; i < 100; i++) {
      // eslint-disable-next-line no-await-in-loop
      await this.exchangeDumpTokenForValueToken(amountToSwap);

      // eslint-disable-next-line no-await-in-loop
      const alUSDPriceInFRAXBPAfter = await this.getDumpTokenPriceInValueToken();
      console.log(
          await AuraCompotableStablePool.fetchTokenBalance(this.vault, this.poolId, this.valueTokenIndex),
          await AuraCompotableStablePool.fetchTokenBalance(this.vault, this.poolId, this.dumpTokenIndex),
      ); // Debug
      if (Number(ethers.formatUnits(alUSDPriceInFRAXBPAfter, this.valueTokenDecimals)) < 1 - (percentToUnbalance / 100)) {
        break;
      }
    }
  }

  //* Private methods *//

  private static async fetchTokenIndex(vault: BalancerVaultContract, poolId: string, token: string): Promise<number> {
    const tokens = await vault.getPoolTokens(poolId);
    for (let i = 0; i < 4; i++) {
      if (tokens.tokens[i] === token) {
        return Number(i);
      }
    }

    return -1;
  }

  private static async fetchTokenBalance(vault: BalancerVaultContract, poolId: string, tokenIndex: number): Promise<bigint> {
    console.log(poolId);
    const tokens = await vault.getPoolTokens(poolId);
    return tokens.balances[tokenIndex];
  }
}
