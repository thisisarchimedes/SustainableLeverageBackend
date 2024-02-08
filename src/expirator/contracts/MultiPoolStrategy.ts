import {ethers} from 'ethers';
import MultiPoolStrategyABI from '../ABIs/MultiPoolStrategy.json';
import {EthereumAddress} from '@thisisarchimedes/backend-sdk';

class MultiPoolStrategy {
  private contract: ethers.Contract;

  constructor(private wallet: ethers.Wallet, contractAddress: EthereumAddress) {
    this.contract = new ethers.Contract(contractAddress.toString(), MultiPoolStrategyABI, wallet);
  }

  async convertToAssets(shares: bigint): Promise<bigint> {
    return await this.contract.convertToAssets(shares);
  }

  async decimals(): Promise<number> {
    return await this.contract.decimals();
  }

  async asset(): Promise<string> {
    return await this.contract.asset();
  }
}

export default MultiPoolStrategy;
