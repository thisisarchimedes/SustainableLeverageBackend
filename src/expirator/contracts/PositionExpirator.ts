import { ethers } from 'ethers';
import { ClosePositionParamsStruct } from "@thisisarchimedes/backend-sdk";
import PositionExpiratorABI from '../ABIs/PositionExpirator.json';


class MyContract {
    private contract: ethers.Contract;

    constructor(private provider: ethers.Provider, contractAddress: string) {
        this.contract = new ethers.Contract(contractAddress, PositionExpiratorABI, provider);
    }

    async expirePosition(nftId: ethers.BigNumberish, params: ClosePositionParamsStruct): Promise<void> {
        const tx = await this.contract.expirePosition(nftId, params);
        await tx.wait();
    }
}

export default MyContract;
