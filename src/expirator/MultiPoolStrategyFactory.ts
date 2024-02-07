import {EthereumAddress} from '@thisisarchimedes/backend-sdk';
import {ethers} from 'ethers';
import MultiPoolStrategy from './contracts/MultiPoolStrategy';

export class MultiPoolStrategyFactory {
  private provider: ethers.Provider;

  constructor(provider: ethers.Provider) {
    this.provider = provider;
  }

  create(address: EthereumAddress): MultiPoolStrategy {
    return new MultiPoolStrategy(this.provider, address);
  }
}
