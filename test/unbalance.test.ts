import * as assert from 'assert';
import { ethers } from "ethers";
import { CurvePoolABI__factory } from '../types/ethers-contracts/factories/CurvePoolABI__factory';
import { CurvePoolABI } from '../types/ethers-contracts';

const RPC = "https://rpc.tenderly.co/fork/3cf571eb-1d95-483e-880b-4ba29f325f5f";
const FRAXBP = "0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC"
const CURVE_POOL = "0xB30dA2376F63De30b42dC055C93fa474F31330A5";
const PRIVATE_KEY = "0xba4ba06bdf2b4d8b3df2b415bf9e4ffdae189b18eab1246ea5617916ac0941a9";


describe('Unbalance pool', function () {
  let provider: ethers.providers.JsonRpcProvider;
  let signer: ethers.Signer;

  before(() => {
    // Set up a provider (e.g., Infura, Alchemy, or local node)
    provider = new ethers.providers.JsonRpcProvider(RPC);
    signer = new ethers.Wallet(PRIVATE_KEY).connect(provider)

  })


  it('Unbalance pegged curve pool', async function () {



    // Create a contract instance
    const pool = CurvePoolABI__factory.connect(CURVE_POOL, provider);

    const tokenIndex = await tokenBalance(pool, FRAXBP);

    const balances = await pool.balances(tokenIndex);


    // // value asset is < 25% of the pool
    // assert.ok(newPrice < price * 0.75);
    // TODO: check balances

  });

  // Helper Functions
  async function tokenBalance(pool: CurvePoolABI, token: string) {
    let tokenIndex = 0;
    for (let i = 0; i < 8; i++) {
      const _token = await pool.coins(i);
      if (_token == token) {
        tokenIndex = i;
        break;
      }
    }
    return tokenIndex;
  }
});
