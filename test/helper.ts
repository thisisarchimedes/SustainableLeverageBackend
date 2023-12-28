import { ethers } from 'hardhat';
import { type CurvePoolABI } from '../types/ethers-contracts/test/ABIs/CurvePoolABI';
import { ALUSD, FRAXBP } from './addresses';
import '@nomicfoundation/hardhat-ethers';
import { type HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { Address } from '../types/common';

type MemorySlot = {
	slot: number;
	isVyper?: boolean;
};
const tokenAddressToSlot: { [key: Address]: MemorySlot } = {};
tokenAddressToSlot[ALUSD] = { slot: 1 };
tokenAddressToSlot[FRAXBP] = { slot: 7, isVyper: true };

const toBytes32 = (bn: bigint) => ethers.hexlify(ethers.zeroPadValue(ethers.toBeHex(bn), 32));

const setStorageAt = async (address: Address, index: string, value: string) => {
	await ethers.provider.send('hardhat_setStorageAt', [address, index, value]);
	await ethers.provider.send('evm_mine', []); // Just mines to the next block
};

const setERC20Balance = async (userAddress: Address, tokenAddress: Address, balance: bigint) => {
	const keyComponents = tokenAddressToSlot[tokenAddress].isVyper ? [tokenAddressToSlot[tokenAddress].slot, userAddress] : [userAddress, tokenAddressToSlot[tokenAddress].slot];
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

async function fetchTokenIndex(pool: CurvePoolABI, token: Address): Promise<number> {
	let tokenIndex = 0;
	for (let i = 0; i < 4; i++) {
		// eslint-disable-next-line no-await-in-loop
		const _token = await pool.coins(i);

		if (_token === token) {
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
