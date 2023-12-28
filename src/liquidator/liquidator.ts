import { ethers } from 'hardhat';
import '@nomicfoundation/hardhat-ethers';
import { Client } from 'pg';
import { PositionLiquidator__factory } from '../../types/ethers-contracts/factories/src/ABIs/PositionLiquidator__factory';
// import { LeveragedStrategy__factory } from '../../types/ethers-contracts/factories/src/ABIs/LeveragedStrategy__factory';
import { PositionLedger__factory } from '../../types/ethers-contracts/factories/src/ABIs/PositionLedger__factory';
import { MultiPoolStrategy__factory } from '../../types/ethers-contracts/factories/src/ABIs/MultiPoolStrategy__factory';
import { ERC20__factory } from '../../types/ethers-contracts/factories/src/ABIs/ERC20__factory';
import { Config } from '../lib/config-service';
import { CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core';
import { Protocol } from '@uniswap/router-sdk';
import { AlphaRouter, SwapRoute } from '@uniswap/smart-order-router';
import { ethers as uniSwapEthers } from '@uniswap/smart-order-router/node_modules/ethers';
import { Pool } from '@uniswap/v3-sdk';
import { Provider } from 'ethers';
import { Address } from '../../types/common';
import { WBTC, WBTC_DECIMALS } from '../constants';

const POSITION_LEDGER = '0xaE251Cd1a1d8121876cA609141bA5C63C0889e42'; // TODO: remove

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

    // TODO: add more conditions for liquidation

    // Simulate the transaction
    try {
      const payload = await getPayload(signer.provider!, nftId);

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

const getPayload = async (provider: Provider, nftId: number): Promise<string> => {
  const positionLedger = PositionLedger__factory.connect(POSITION_LEDGER, provider);
  const ledgerEntry = await positionLedger.getPosition(nftId);

  const strategy = MultiPoolStrategy__factory.connect(await ledgerEntry.strategyAddress, provider);
  const strategyAsset = await strategy.asset();
  const minimumExpectedAssets = await strategy.convertToAssets(ledgerEntry.strategyShares);

  const asset = ERC20__factory.connect(strategyAsset, provider);
  const assetDecimals = await asset.decimals();

  const { payload } = await fetchUniswapRouteAndBuildPayload(
    ethers.formatUnits(minimumExpectedAssets, assetDecimals),
    strategyAsset,
    Number(assetDecimals),
    WBTC,
    WBTC_DECIMALS,
  );

  return payload;
}

/**
 * Initializes the uniswap router instance
 * @returns {Object} The router instance
 */
const initializeRouter = () => {
  const router = new AlphaRouter({
    chainId: 1,
    provider: new uniSwapEthers.providers.JsonRpcProvider(process.env.MAINNET_RPC_URL),
  });
  return router;
};

/**
 * Function to retrieve the uniswap route from the router
 * @param {Object} router - The router instance
 * @param {string} amount - The amount to swap
 * @param {Address} inputToken - The asset to swap from
 * @param {number} inputTokenDecimals - The asset decimals
 * @param {Address} outputToken - The asset to swap to
 * @param {number} outputTokenDecimals - The asset decimals
 * @returns {Object} The uniswap route
 */
export const fetchUniswapRouteAndBuildPayload = async (
  amount: string,
  inputToken: Address,
  inputTokenDecimals: number,
  outputToken: Address,
  outputTokenDecimals: number
): Promise<{ payload: string; swapOutputAmount: string }> => {
  try {
    const router = initializeRouter();
    // Primary token always will be WBTC for now
    const primaryAsset = new Token(1, inputToken, inputTokenDecimals);
    // Secondary token will be the strategy underlying asset
    const secondaryAsset = new Token(1, outputToken, outputTokenDecimals);
    // We only use V3 protocol for now
    const protocols = ["V3"] as Protocol[];
    if (!primaryAsset || !secondaryAsset) throw "Please enter a valid asset";
    const amountBN = ethers.parseUnits(amount, inputTokenDecimals).toString();
    // We retrieve the route from the uniswap router
    const route: SwapRoute | null = await router.route(
      CurrencyAmount.fromRawAmount(primaryAsset, amountBN),
      secondaryAsset,
      TradeType.EXACT_INPUT,
      undefined,
      { protocols }
    );
    const { pools, tokenPath, swapOutputAmount } = mapRouteData(route);

    const { dataTypes, dataValues } = buildPathFromUniswapRouteData(
      pools,
      tokenPath
    );

    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    const timestamp = Math.floor(Date.now() / 1000);
    const encodedPath = ethers.solidityPacked(dataTypes, dataValues);
    const deadline = BigInt(timestamp + 1000);
    const payload = abiCoder.encode(
      ["(bytes,uint256)"],
      [[encodedPath, deadline]]
    );
    return { swapOutputAmount, payload };
  } catch (err) {
    console.log("fetchUniswapRoute err: ", err);
    throw err;
  }
};

/**
 * Function to map the route data from uniswap
 * @param {Object} route - The route data
 * @returns {Object} Formatted route data with the necessary data such as pools, token path and swap output amount
 */
const mapRouteData = (route: SwapRoute | null) => {
  if (!route) throw new Error("Please enter a valid route");
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error 
  const pools = route.route[0].route.pools;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error 
  const tokenPath = route.route[0].route.tokenPath;
  const swapOutputAmount = route.quote.toExact() || "0";
  return { pools, tokenPath, swapOutputAmount };
};

/**
 * Builds the path data for a Uniswap route
 * @param pools The pools to build the path from
 * @param tokens The tokens to build the path from
 */
const buildPathFromUniswapRouteData = (pools: Pool[], tokens: Token[]) => {
  const dataTypes = [];
  const dataValues = tokens.map((t) => t.address);
  let feeIndex = 1;
  for (let i = 0; i < pools.length; i++) {
    const currentPool: Pool = pools[i];
    if (i === 0) {
      dataTypes.push("address", "uint24", "address");
    } else {
      dataTypes.push("uint24", "address");
    }
    dataValues.splice(feeIndex, 0, currentPool.fee.toString());
    feeIndex += 2;
  }
  return { dataTypes, dataValues };
};
