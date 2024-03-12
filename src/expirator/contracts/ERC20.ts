import {ethers} from 'ethers';
import {EthereumAddress} from '@thisisarchimedes/backend-sdk';
import ERC20ABI from '../ABIs/ERC20.json';

class ERC20 {
  private contract: ethers.Contract;

  constructor(private wallet: ethers.Wallet, contractAddress: EthereumAddress) {
    this.contract = new ethers.Contract(contractAddress.toString(), ERC20ABI, wallet);
  }

  async balanceOf(address: EthereumAddress): Promise<bigint> {
    const balance = await this.contract.balanceOf(address.toString());
    return balance;
  }
}

export default ERC20;
