import { ethers } from 'hardhat';
import '@nomicfoundation/hardhat-ethers';
import { Client } from 'pg';
import { PositionCloser__factory } from '../../types/ethers-contracts';
import "dotenv/config";

// const leveragedStrategyAddress = process.env.LEVERAGED_STRATEGY!;
const positionCloserAddress = process.env.POSITION_CLOSER!;

export default async function liquidator(client: Client) {
  const [signer] = await ethers.getSigners();
  // const leveragedStrategy = LeveragedStrategy__factory.connect(leveragedStrategyAddress, signer);
  const positionCloser = PositionCloser__factory.connect(positionCloserAddress, signer);

  // Query to get all nftIds
  const res = await client.query('SELECT "nftId" FROM "LeveragePosition"');

  for (const row of res.rows) {
    const nftId: number = row.nftId;

    // Call the smart contract function
    // const isLiquidatable = await leveragedStrategy['isPositionLiquidatable(uint256)'](nftId);
    // TODO: add more conditions for liquidation

    // console.log(`NFT ID: ${nftId}, value in wbtc: ${await leveragedStrategy.previewPositionValueInWBTC(nftId)}`);
    // console.log(`NFT ID: ${nftId}, is liquidatable: ${isLiquidatable}`);

    // Simulate the transaction
    try {
      const payload = "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000652e57930000000000000000000000000000000000000000000000000000000000000042a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000bb8c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20001f42260fac5e5542a773aa44fbcfedf7c193bc2c599000000000000000000000000000000000000000000000000000000000000";

      const response = await positionCloser.liquidatePosition(nftId, 0, "0", payload, "0x0000000000000000000000000000000000000000")

      // Wait for the transaction to be mined
      const receipt = await response.wait();
      console.log(receipt);
      console.log(`Position ${nftId} liquidated`);
    } catch (error) {
      console.log(error);
      console.log(`Position ${nftId} is not liquidatable`);
    }
  }
}
