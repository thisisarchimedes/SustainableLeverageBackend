import { ethers } from 'ethers';
import MultiPoolStrategyABI from '../ABIs/MultiPoolStrategy.json';

class MultiPoolStrategy {
    private contract: ethers.Contract;

    constructor(private provider: ethers.Provider, contractAddress: string) {
        this.contract = new ethers.Contract(contractAddress, MultiPoolStrategyABI, provider);
    }

    async convertToAssets(shares: bigint): Promise<bigint> {
        return await this.contract.convertToAssets(shares);
    }

    async decimals(): Promise<number> {
        return await this.contract.decimals();
    }
}

export default MultiPoolStrategy;
