import { CurvePool, Logger } from '@thisisarchimedes/backend-sdk';
import {TokenIndexes} from '../types/TokenIndexes';
class CurvePoolMonitor {
  private curvePool: CurvePool;
  private tokenIndexes:TokenIndexes;

  constructor(curvePool: CurvePool, tokenIndexes :TokenIndexes) {
    this.curvePool = curvePool;
    this.tokenIndexes = tokenIndexes;
  }

  async getPoolBalances(): Promise<bigint[]> {
    try {
      const wbtcIndex = this.tokenIndexes['WBTC'];
      const wbtcBalance: bigint = await this.curvePool.balances(wbtcIndex);
      const lvBTCBalance: bigint = await this.curvePool.balances(this.tokenIndexes['lvBTC']);


      return [wbtcBalance, lvBTCBalance];
    } catch (error) {
      Logger.getInstance().error(`Error fetching pool balances: ${(error as Error).message}`) ;
      throw error;
    }
  }
}

export default CurvePoolMonitor;
