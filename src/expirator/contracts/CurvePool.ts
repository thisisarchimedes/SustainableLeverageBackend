import { ethers } from 'ethers';
import CurvePoolABI from '../ABIs/CurvePool.json';
import { EthereumAddress } from '@thisisarchimedes/backend-sdk';

class CurvePool {
  private contract: ethers.Contract;

  constructor(private wallet: ethers.Wallet, contractAddress: EthereumAddress) {
    this.contract = new ethers.Contract(contractAddress.toString(), CurvePoolABI, wallet);
  }

  async balances(index: number): Promise<bigint> {
    return await this.contract.balances(index);
  }

  async get_dy(i: number, j: number, dx: bigint): Promise<bigint> {
    return await this.contract.get_dy(i, j, dx);
  }
}

export default CurvePool;