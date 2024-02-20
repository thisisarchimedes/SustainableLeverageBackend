import {ethers} from 'ethers';
import {EthereumAddress} from '@thisisarchimedes/backend-sdk';
import PositionLedgerABI from '../ABIs/PositionLedger.json';


class PositionLedger {
  private contract: ethers.Contract;

  constructor(private wallet: ethers.Wallet, contractAddress: EthereumAddress) {
    this.contract = new ethers.Contract(contractAddress.toString(), PositionLedgerABI, wallet);
  }

  async getPosition(nftId: number): Promise<any> {
    return await this.contract.getPosition(nftId);
  }
}

export default PositionLedger;
