import { ethers } from 'hardhat';
import '@nomicfoundation/hardhat-ethers';
import { Client } from 'pg';
import { PositionLiquidator__factory } from '../../types/ethers-contracts/factories/src/ABIs/PositionLiquidator__factory';
import { LeveragedStrategy__factory } from '../../types/ethers-contracts/factories/src/ABIs/LeveragedStrategy__factory';
import { Config } from '../lib/config-service';


export default async function liquidator(config: Config, client: Client) {
  console.log(config);
  const [signer] = await ethers.getSigners();
  const leveragedStrategy = LeveragedStrategy__factory.connect(config.leveragedStrategy, signer);
  const positionLiquidator = PositionLiquidator__factory.connect(config.positionLiquidator, signer);

  // Query to get all nftIds
  const res = await client.query('SELECT "nftId" FROM "LeveragePosition"');

  for (const row of res.rows) {
    const nftId: number = row.nftId;

    // Call the smart contract function
    const isLiquidatable = await leveragedStrategy.isPositionLiquidatableEstimation(nftId);
    // TODO: add more conditions for liquidation

    console.log(`NFT ID: ${nftId}, value in wbtc: ${await leveragedStrategy.previewPositionValueInWBTC(nftId)}`);
    console.log(`NFT ID: ${nftId}, is liquidatable: ${isLiquidatable}`);

    // Simulate the transaction
    try {
      const payload = "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000652e57930000000000000000000000000000000000000000000000000000000000000042a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000bb8c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20001f42260fac5e5542a773aa44fbcfedf7c193bc2c599000000000000000000000000000000000000000000000000000000000000";

      const response = await positionLiquidator.liquidatePosition({
        nftId,
        minWBTC: 0,
        swapRoute: "0",
        swapData: payload,
        exchange: "0x0000000000000000000000000000000000000000",
      })

      // Wait for the transaction to be mined
      const receipt = await response.wait();
      console.log(receipt);
      console.log(`Position ${nftId} liquidated`);
    } catch (error) {
      console.log(error);
      console.log(`Position ${nftId} is not liquidatable`);
    }
    break; // TODO: remove
  }
}
