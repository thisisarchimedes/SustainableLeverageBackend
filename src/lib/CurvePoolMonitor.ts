import {ethers} from 'ethers';

class CurvePoolMonitor {
  private provider: ethers.JsonRpcProvider;
  private curvePoolContract: ethers.Contract;

  constructor(rpcUrl: string, poolAddress: string, abi: string[]) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.curvePoolContract = new ethers.Contract(poolAddress, abi, this.provider);
  }

  async getPoolBalances(): Promise<bigint[]> {
    try {
      const balances: bigint[] = await this.curvePoolContract.get_balances();
      return balances;
    } catch (error) {
      console.error('Error fetching pool balances:', error);
      throw error;
    }
  }
}

export default CurvePoolMonitor;
