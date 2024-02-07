import { ethers } from 'ethers';
import { ClosePositionParamsStruct, EthereumAddress } from "@thisisarchimedes/backend-sdk";
import PositionExpiratorABI from '../ABIs/PositionExpirator.json';


class PositionExpirator {
    private contract: ethers.Contract;

    constructor(private provider: ethers.Provider, contractAddress: EthereumAddress) {
        this.contract = new ethers.Contract(contractAddress.toString(), PositionExpiratorABI, provider);
    }

    async expirePosition(nftId: ethers.BigNumberish, params: ClosePositionParamsStruct): Promise<void> {
        const tx = await this.contract.expirePosition(nftId, params);
        await tx.wait();
    }
}

export default PositionExpirator;
