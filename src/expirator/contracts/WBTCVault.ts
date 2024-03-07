import { ethers } from 'ethers';
import WBTCVaultABI from '../ABIs/WBTCVault.json';
import { EthereumAddress } from '@thisisarchimedes/backend-sdk';

class WBTCVault {
    private contract: ethers.Contract;

    constructor(private wallet: ethers.Wallet, contractAddress: EthereumAddress) {
        this.contract = new ethers.Contract(contractAddress.toString(), WBTCVaultABI.abi, wallet);
    }

    async swapToLVBTC(amount: bigint, minAmount: bigint): Promise<void> {
        await this.contract.swapToLVBTC(amount, minAmount);
    }

    async swapToWBTC(amount: bigint, minAmount: bigint): Promise<void> {
        await this.contract.swapToWBTC(amount, minAmount);
    }
}

export default WBTCVault;