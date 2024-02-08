import {EthereumAddress} from '@thisisarchimedes/backend-sdk';
import {ethers} from 'ethers';
import MultiPoolStrategy from './contracts/MultiPoolStrategy';

export class MultiPoolStrategyFactory {
  private wallet: ethers.Wallet;

  constructor(wallet: ethers.Wallet) {
    this.wallet = wallet;
  }

  create(address: EthereumAddress): MultiPoolStrategy {
    return new MultiPoolStrategy(this.wallet, address);
  }
}
