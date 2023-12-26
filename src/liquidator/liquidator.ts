import { ethers } from 'hardhat';
import '@nomicfoundation/hardhat-ethers';
import { Client } from 'pg';
import { PositionLiquidator__factory } from '../../types/ethers-contracts/factories/src/ABIs/PositionLiquidator__factory';
// import { LeveragedStrategy__factory } from '../../types/ethers-contracts/factories/src/ABIs/LeveragedStrategy__factory';
import { Config } from '../lib/config-service';


export default async function liquidator(config: Config, client: Client) {
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, ethers.provider);

  // const leveragedStrategy = LeveragedStrategy__factory.connect(config.leveragedStrategy, signer);
  const positionLiquidator = PositionLiquidator__factory.connect(config.positionLiquidator, signer);

  // Query to get all nftIds
  const res = await client.query('SELECT "nftId" FROM "LeveragePosition" WHERE "positionState" = \'OPEN\'');

  for (const row of res.rows) {
    const nftId: number = row.nftId;

    // Call the smart contract function
    // console.log(`NFT ID: ${nftId}, value in wbtc: ${await leveragedStrategy.previewPositionValueInWBTC(nftId)}`);
    // const isLiquidatable = await leveragedStrategy.isPositionLiquidatableEstimation(nftId);
    // console.log(`NFT ID: ${nftId}, is liquidatable: ${isLiquidatable}`);
    // continue;

    // TODO: add more conditions for liquidation

    // Simulate the transaction
    try {
      const payload = "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000006589e0be0000000000000000000000000000000000000000000000000000000000000042a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000bb8c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20001f42260fac5e5542a773aa44fbcfedf7c193bc2c599000000000000000000000000000000000000000000000000000000000000";
      // const payload = "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000065887dd10000000000000000000000000000000000000000000000000000000000000042a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000bb8c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20001f42260fac5e5542a773aa44fbcfedf7c193bc2c599000000000000000000000000000000000000000000000000000000000000";

      const tx = await positionLiquidator.liquidatePosition({
        nftId,
        minWBTC: 0,
        swapRoute: "0",
        swapData: payload,
        exchange: "0x0000000000000000000000000000000000000000",
      });
      console.log(tx);
      return;

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      // const contract = new ethers.Contract(config.positionLiquidator, require('../ABIs/PositionLiquidator.json').abi, signer);
      // const tx = await contract.liquidatePosition.populateTransaction({
      //   nftId,
      //   minWBTC: 0,
      //   swapRoute: "0",
      //   swapData: payload,
      //   exchange: "0x0000000000000000000000000000000000000000",
      // });
      // Transaction details
      // const tx = {
      //   to: 'recipient_address_here',
      //   value: ethers.parseEther('0.01'), // Amount of Ether to send
      //   gasLimit: ethers.toBeHex("21000"), // Standard gas limit for sending Ether
      //   gasPrice: ethers.toBeHex("20000000000"), // Gas price in wei (20 gwei in this example)
      //   nonce: await signer.getNonce(), // Nonce for your account
      //   data: '000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000006589e00a0000000000000000000000000000000000000000000000000000000000000042a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000bb8c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20001f42260fac5e5542a773aa44fbcfedf7c193bc2c599000000000000000000000000000000000000000000000000000000000000'
      //   // You can add other fields like data for contract interactions
      // };

      // // Sign the transaction
      // const signedTx = await signer.signTransaction(tx);

      // console.log('Signed Transaction:', signedTx);

      // // Send the signed transaction
      // const txResponse = await signer.sendTransaction(tx);
      // console.log('Transaction Hash:', txResponse.hash);
      // console.log("Composed Transaction:", tx);
      // return;

      // TODO: compare, cuz solidity worked

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
