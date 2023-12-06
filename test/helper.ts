import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { CurvePoolABI } from '../types/ethers-contracts';


const tokenAddressToSlot: { [id: string]: number } = {
    ALUSD: 1
};

const toBytes32 = (bn: BigNumber) => {
    return ethers.utils.hexlify(ethers.utils.zeroPad(bn.toHexString(), 32));
};

const setStorageAt = async (address: string, index: string, value: string) => {
    await ethers.provider.send("hardhat_setStorageAt", [address, index, value]);
    await ethers.provider.send("evm_mine", []); // Just mines to the next block
};

const setERC20Balance = async (userAddress: string, tokenAddress: string, balance: BigNumber) => {
    const index = ethers.utils.solidityKeccak256([
      "uint256", "uint256"
    ], [userAddress, tokenAddressToSlot[tokenAddress]]);
    await setStorageAt(tokenAddress, index, toBytes32(balance));
};

function RemoveDecimals(number: BigNumber, decimals: number) {
    return Number(ethers.utils.formatUnits(number, decimals))
}

async function getMainSigner() {
    const [signer] = await ethers.getSigners();
    return signer;
}

async function fetchTokenIndex(pool: CurvePoolABI, token: string): Promise<number> {
    let tokenIndex = 0;
    for (let i = 0; i < 4; i++) {
      let _token;
      _token = await pool.coins(i);
  
      if (_token == token) {
        tokenIndex = i;
        break;
      }
    }
    return Number(tokenIndex.toString());
  }

const helper = {
    setERC20Balance,
    RemoveDecimals,
    getMainSigner,
    fetchTokenIndex
};

export default helper;
