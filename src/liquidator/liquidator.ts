import { ethers } from 'hardhat';
import '@nomicfoundation/hardhat-ethers';
import { Client } from 'pg';
import { Config } from '../lib/config-service';
import { Provider } from 'ethers';
import { WBTC, WBTC_DECIMALS } from '../constants';
import { AMMs, Contracts, EthereumAddress } from "@thisisarchimedes/backend-sdk";

export default async function liquidator(config: Config, client: Client) {
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, ethers.provider);

  // const leveragedStrategy = LeveragedStrategy__factory.connect(config.leveragedStrategy, signer);
  const positionLiquidator = Contracts.leverage.positionLiquidator(config.positionLiquidator, signer);

  // Query to get all nftIds
  const res = await client.query('SELECT "nftId" FROM "LeveragePosition" WHERE "positionState" = \'OPEN\'');

  for (const row of res.rows) {
    const nftId: number = row.nftId;

    // Call the smart contract function
    // console.log(`NFT ID: ${nftId}, value in wbtc: ${await leveragedStrategy.previewPositionValueInWBTC(nftId)}`);
    // const isLiquidatable = await leveragedStrategy.isPositionLiquidatableEstimation(nftId);
    // console.log(`NFT ID: ${nftId}, is liquidatable: ${isLiquidatable}`);

    // TODO: add more conditions for liquidation

    // Simulate the transaction
    try {
      const payload = await getPayload(signer.provider!, config, nftId);

      const response = await positionLiquidator.liquidatePosition({
        nftId,
        minWBTC: 0,
        swapRoute: "0",
        swapData: payload,
        exchange: "0x0000000000000000000000000000000000000000",
      });

      // Wait for the transaction to be mined
      await response.wait(); // TODO: remove
      console.log(`Position ${nftId} liquidated`);
    } catch (error) {
      console.log(error);
      console.log(`Position ${nftId} is not liquidatable`);
    }
    break; // TODO: remove
  }
}

const getPayload = async (provider: Provider, config: Config, nftId: number): Promise<string> => {
  const positionLedger = Contracts.leverage.positionLedger(config.positionLedger, provider);
  const ledgerEntry = await positionLedger.getPosition(nftId);

  const strategy = Contracts.general.multiPoolStrategy(new EthereumAddress(ledgerEntry.strategyAddress), provider);
  const strategyAsset = await strategy.asset();
  const minimumExpectedAssets = await strategy.convertToAssets(ledgerEntry.strategyShares);

  const asset = Contracts.general.ERC20(new EthereumAddress(strategyAsset), provider);
  const assetDecimals = await asset.decimals();

  const uniSwap = new AMMs.UniSwap(process.env.MAINNET_RPC_URL!);
  const { payload } = await uniSwap.buildPayload(
    ethers.formatUnits(minimumExpectedAssets, assetDecimals),
      strategyAsset,
      Number(assetDecimals),
      WBTC,
      WBTC_DECIMALS,
    );

  return payload;
}
