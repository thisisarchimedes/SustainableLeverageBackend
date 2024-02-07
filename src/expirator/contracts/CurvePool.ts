import { ethers } from 'ethers';
import CurvePoolABI from '../ABIs/CurvePool.json';

class CurvePool {
    private contract: ethers.Contract;

    constructor(private provider: ethers.Provider, contractAddress: string) {
        this.contract = new ethers.Contract(contractAddress, CurvePoolABI, provider);
    }

    async balances(index: number): Promise<bigint> {
        return await this.contract.balances(index);
    }
}

export default CurvePool;
