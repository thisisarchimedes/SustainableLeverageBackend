import {ethers} from 'ethers';
import {EthereumAddress} from '@thisisarchimedes/backend-sdk';
import PositionLedgerABI from '../ABIs/PositionLedger.json';
import {populateLedgerEntry, LedgerEntry} from '../../types/LedgerEntry';


class PositionLedger {
  private contract: ethers.Contract;

  constructor(private wallet: ethers.Wallet, contractAddress: EthereumAddress) {
    this.contract = new ethers.Contract(contractAddress.toString(), PositionLedgerABI, wallet);
  }

  async getPosition(nftId: number): Promise<LedgerEntry> {
    const position = await this.contract.getPosition(nftId);
    return populateLedgerEntry(position);
  }
}

export default PositionLedger;
