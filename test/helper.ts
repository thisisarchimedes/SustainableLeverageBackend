import { ethers } from 'hardhat';
import { ALUSD, FRAXBP } from './addresses';
import '@nomicfoundation/hardhat-ethers';
import { type HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { CurvePool, EthereumAddress } from '@thisisarchimedes/backend-sdk';

type MemorySlot = {
	slot: number;
	isVyper?: boolean;
};
const tokenAddressToSlot: { [key: string]: MemorySlot } = {};
tokenAddressToSlot[ALUSD.toLowerCase()] = { slot: 1 };
tokenAddressToSlot[FRAXBP.toLowerCase()] = { slot: 7, isVyper: true };

const toBytes32 = (bn: bigint) => ethers.hexlify(ethers.zeroPadValue(ethers.toBeHex(bn), 32));

const setStorageAt = async (address: EthereumAddress, index: string, value: string) => {
	await ethers.provider.send('hardhat_setStorageAt', [address.toString(), index, value]);
	await ethers.provider.send('evm_mine', []); // Just mines to the next block
};

const setERC20Balance = async (userAddress: EthereumAddress, tokenAddress: EthereumAddress, balance: bigint) => {
	const keyComponents = tokenAddressToSlot[tokenAddress.toString()].isVyper ? [tokenAddressToSlot[tokenAddress.toString()].slot, userAddress.toString()] : [userAddress.toString(), tokenAddressToSlot[tokenAddress.toString()].slot];
	const index = ethers.solidityPackedKeccak256([
		'uint256', 'uint256',
	], keyComponents);
	await setStorageAt(tokenAddress, index, toBytes32(balance));
};

function removeDecimals(number: bigint, decimals: number) {
	return Number(ethers.formatUnits(number, decimals));
}

async function getMainSigner(): Promise<HardhatEthersSigner> {
	const [signer] = await ethers.getSigners();
	return signer;
}

async function fetchTokenIndex(pool: CurvePool, token: EthereumAddress): Promise<number> {
	let tokenIndex = 0;
	for (let i = 0; i < 4; i++) {
		// eslint-disable-next-line no-await-in-loop
		const _token = await pool.coins(i);
		if (_token.toLowerCase() === token.toString()) {
			tokenIndex = i;
			break;
		}
	}

	return Number(tokenIndex.toString());
}

export default {
	setERC20Balance,
	removeDecimals,
	getMainSigner,
	fetchTokenIndex,
};
