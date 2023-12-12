import { ethers } from 'ethers';
import { Client } from 'pg';
import { LeveragedStrategy__factory } from '../../types/ethers-contracts';
import "dotenv/config";

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const leveragedStrategy = LeveragedStrategy__factory.connect(process.env.LEVERAGED_STRATEGY!, provider);
// const positionCloser = PositionCloser__factory.connect(process.env.POSITION_CLOSER!, provider);

export default async function liquidator(client: Client) {
  // Query to get all nftIds
  const res = await client.query('SELECT "nftId" FROM "LeveragePosition"');

  for (const row of res.rows) {
    const nftId: number = row.nftId;

    // Call the smart contract function
    const isLiquidatable = await leveragedStrategy['isPositionLiquidatable(uint256)'](nftId);
    // TODO: add more conditions for liquidation
    if (isLiquidatable) {
      console.log(`NFT ID: ${nftId}, is liquidatable: ${isLiquidatable}`);
      // positionCloser.liquidatePosition(nftId, minWBTC, swapRoute, swapData, exchange); // TODO
    }
  }
}
