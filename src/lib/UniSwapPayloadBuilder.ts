import UniSwap from './UniSwap';
import {ethers, Signer} from 'ethers';
import {WBTC, WBTC_DECIMALS} from '../constants';
import {MultiPoolStrategy__factory} from '../types/leverage-contracts/factories/MultiPoolStrategy__factory';
import {ERC20__factory} from '../types/leverage-contracts/factories/ERC20__factory';

export default class UniSwapPayloadBuilder {
  /**
  * Returns the swap payload to open a position
  * @param strategy strategy address
  * @param strategyShares shares amount
  * @returns string - swap payload to open the position
  */
  public static readonly getOpenPositionSwapPayload = async (
      signer: Signer,
      amount: bigint,
      strategy: string,
      currentTimestamp: number,
  ): Promise<string> => {
    // console.log('Building payload for:', nftId); // Debug
    const strategyContract = MultiPoolStrategy__factory.connect(strategy, signer);
    const strategyAsset = await strategyContract.asset(); // Optimization: can get from DB

    if (strategyAsset.toString() === WBTC.toString()) {
      return '0x';
    }

    const asset = ERC20__factory.connect(strategyAsset, signer);
    const assetDecimals = await asset.decimals(); // Optimization: can get from DB

    const uniSwap = new UniSwap(process.env.MAINNET_RPC_URL!);
    const {payload} = await uniSwap.buildPayload(
        ethers.formatUnits(amount, WBTC_DECIMALS),
        WBTC,
        WBTC_DECIMALS,
        strategyAsset,
        Number(assetDecimals),
        currentTimestamp,
    );

    return payload;
  };

  /**
  * Returns the swap payload to close the position
  * @param strategy strategy address
  * @param strategyShares shares amount
  * @returns string - swap payload to close the position
  */
  public static readonly getClosePositionSwapPayload = async (
      signer: Signer,
      strategy: string,
      strategyShares: number,
      currentTimestamp: number,
  ): Promise<string> => {
    // console.log('Building payload for:', nftId); // Debug
    const strategyContract = MultiPoolStrategy__factory.connect(strategy, signer);
    const strategyAsset = await strategyContract.asset(); // Optimization: can get from DB

    if (strategyAsset.toString() === WBTC.toString()) {
      return '0x';
    }

    const asset = ERC20__factory.connect(strategyAsset, signer);
    const assetDecimals = await asset.decimals(); // Optimization: can get from DB
    const strategySharesN = ethers.parseUnits(strategyShares.toFixed(Number(assetDecimals)), assetDecimals); // Converting float to bigint
    const minimumExpectedAssets = await strategyContract.convertToAssets(strategySharesN); // Must query live

    const uniSwap = new UniSwap(process.env.MAINNET_RPC_URL!);
    const {payload} = await uniSwap.buildPayload(
        ethers.formatUnits(minimumExpectedAssets, assetDecimals),
        strategyAsset,
        Number(assetDecimals),
        WBTC,
        WBTC_DECIMALS,
        currentTimestamp,
    );

    return payload;
  };
}
