import { assert } from 'chai';
import UniSwap from '../src/lib/Uniswap'
import { EthereumAddress } from '@thisisarchimedes/backend-sdk';
import "dotenv/config"

export const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
export const WETH_DECIMALS = 18;
export const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
export const WBTC_DECIMALS = 8;

describe('UniSwap', function () {
  let uniSwap: UniSwap;

  beforeEach(() => {
    uniSwap = new UniSwap(process.env.MAINNET_RPC_URL!);
  })

  it('Test payload build', async () => {
    const { swapOutputAmount, payload } = await uniSwap.buildPayload(
      (1 ** WETH_DECIMALS).toString(),
      new EthereumAddress(WETH),
      WETH_DECIMALS,
      new EthereumAddress(WBTC),
      WBTC_DECIMALS
    );

    // Eth should be more than 0.005 (sanity)
    assert(Number(swapOutputAmount) > 0.005, "swapOutputAmount should be greater than 0.005")
    assert(payload, "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000065940fb6000000000000000000000000000000000000000000000000000000000000002bc02aaa39b223fe8d0a0e5c4f27ead9083c756cc20001f42260fac5e5542a773aa44fbcfedf7c193bc2c599000000000000000000000000000000000000000000")
  })
})
