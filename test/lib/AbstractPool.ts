import {type HardhatEthersSigner} from '@nomicfoundation/hardhat-ethers/signers';
import {CURVE_POOL, CURVE_POOL_ADAPTER, LEVERAGED_STRATEGY} from './addresses';
import {ethers} from 'hardhat';
import {
  Contracts,
  EthereumAddress,
  CurvePool as CurvePoolContract,
  ConvexPoolAdapter,
  LeveragedStrategy,
} from '@thisisarchimedes/backend-sdk';

// Define the abstract class
export abstract class AbstractPool {
  constructor(
    public readonly leveragedStrategy: LeveragedStrategy,
    public readonly contractPool: CurvePoolContract,
    public readonly adapter: ConvexPoolAdapter,
    public readonly valueTokenIndex: number,
    public readonly dumpTokenIndex: number,
    public readonly valueTokenBalance: bigint,
    public readonly dumpTokenBalance: bigint,
    public readonly dumpTokenDecimals: number,
    public readonly valueTokenDecimals: number,
  ) {}

  public abstract exchangeDumpTokenForValueToken(amount: bigint): Promise<void>;
  public abstract exchangeValueTokenForDumpToken(amount: bigint): Promise<void>;
  public abstract getDumpTokenPriceInValueToken(dumpPercentage?: number): Promise<bigint>;
  public abstract rebalance(): Promise<void>;
  public abstract unbalancePosition(nftId: number): Promise<void>;
  public abstract unbalance(percentToUnbalance: number): Promise<void>;

  // protected static async fetchTokenIndex(pool: CurvePoolContract, token: EthereumAddress): Promise<number> {
  //   let tokenIndex = 0;
  //   for (let i = 0; i < 4; i++) {
  //     const _token = await pool.coins(i);
  //     if (_token === token.toString()) {
  //       tokenIndex = i;
  //       break;
  //     }
  //   }

  //   return Number(tokenIndex);
  // }

  static async createInstance(
      signer: HardhatEthersSigner,
      poolAddress: EthereumAddress,
      dumpToken: EthereumAddress,
      valueToken: EthereumAddress,
  ): Promise<AbstractPool> {
    const leveragedStrategy = Contracts.leverage.leveragedStrategy(LEVERAGED_STRATEGY, signer);
    const pool = Contracts.general.curvePool(poolAddress, signer);
    const adapter = Contracts.general.convexPoolAdapter(CURVE_POOL_ADAPTER, signer);
    const valueTokenContract = Contracts.general.erc20(valueToken, signer);
    const dumpTokenContract = Contracts.general.erc20(dumpToken, signer);
    const valueTokenDecimals = Number(await valueTokenContract.decimals());
    const dumpTokenDecimals = Number(await dumpTokenContract.decimals());

    const valueTokenIndex = await AbstractPool.fetchTokenIndex(pool, valueToken);
    const dumpTokenIndex = await AbstractPool.fetchTokenIndex(pool, dumpToken);

    const valueTokenBalance = await pool.balances(valueTokenIndex);
    const dumpTokenBalance = await pool.balances(dumpTokenIndex);

    await valueTokenContract.approve(CURVE_POOL.toString(), ethers.MaxUint256);
    await dumpTokenContract.approve(CURVE_POOL.toString(), ethers.MaxUint256);

    return new CurvePool(
        leveragedStrategy,
        pool,
        adapter,
        valueTokenIndex,
        dumpTokenIndex,
        valueTokenBalance,
        dumpTokenBalance,
        dumpTokenDecimals,
        valueTokenDecimals,
    );
  }
}
