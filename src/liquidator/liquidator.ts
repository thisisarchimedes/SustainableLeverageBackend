import { Client } from 'pg';
import { Config } from '../lib/config-service';
import { Provider, ethers, getDefaultProvider } from 'ethers';
import { WBTC, WBTC_DECIMALS } from '../constants';
import { Contracts, EthereumAddress } from "@thisisarchimedes/backend-sdk";
import UniSwap from '../lib/UniSwap';

const GAS_PRICE_MULTIPLIER = 3n;
const GAS_PRICE_DENOMINATOR = 2n;

export default async function liquidator(config: Config, client: Client) {
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, getDefaultProvider(process.env.RPC_URL!));

  // const leveragedStrategy = LeveragedStrategy__factory.connect(config.leveragedStrategy, signer);
  const positionLiquidator = Contracts.leverage.positionLiquidator(config.positionLiquidator, signer);

  // Query to get all nftIds
  const res = await client.query('SELECT "nftId" FROM "LeveragePosition" WHERE "positionState" = \'LIVE\'');

  for (const row of res.rows) {
    const nftId: number = row.nftId;

    // TODO: add more conditions for liquidation

    // Simulate the transaction
    // TODO: simulate the transaction describe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = await getPayload(signer.provider!, config, nftId);

    // TODO: test that it actually does the "simulation" but not a failed tx
    // TODO: test that it actually liquidates if needed
    try {
      const data = positionLiquidator.interface.encodeFunctionData('liquidatePosition', [{
        nftId,
        minWBTC: 0,
        swapRoute: "0",
        swapData: payload,
        exchange: "0x0000000000000000000000000000000000000000",
      }]);

      // Configure gas price
      let gasPrice = await (await signer.provider!.getFeeData()).gasPrice;
      if (gasPrice && GAS_PRICE_MULTIPLIER && GAS_PRICE_DENOMINATOR) {
        gasPrice = gasPrice * GAS_PRICE_MULTIPLIER / GAS_PRICE_DENOMINATOR;
      }

      // Create a transaction object
      const tx = {
        to: config.positionLiquidator.toString(),
        data,
        gasPrice,
      };

      // Simulate the transaction
      await signer.provider!.call(tx); // ! Simulate tx - reverts on failed simulation
      const response = await signer.provider!.sendTransaction!(tx); // TODO: Double simulates, consider

      // Wait for the transaction to be mined
      await response.wait(); // TODO: should we wait for mining the block?
      console.log(`Position ${nftId} liquidated`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.data === "0x5e6797f9") { // NotEligibleForLiquidation selector
        console.log(`Position ${nftId} is not liquidatable`);
      } else {
        console.log(`Position ${nftId} liquidation errored with:`);
        console.error(error.data); // Send to New Relic
      }
    }
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

  const uniSwap = new UniSwap(process.env.MAINNET_RPC_URL!);
  const { payload } = await uniSwap.buildPayload(
    ethers.formatUnits(minimumExpectedAssets, assetDecimals),
    new EthereumAddress(strategyAsset),
    Number(assetDecimals),
    new EthereumAddress(WBTC),
    WBTC_DECIMALS,
  );

  return payload;
}
