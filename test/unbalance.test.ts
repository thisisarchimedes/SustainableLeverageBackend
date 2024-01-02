import { assert } from 'chai';
import '@nomicfoundation/hardhat-ethers';
import { type HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ALUSD, CURVE_POOL, FRAXBP } from './addresses';
import helper from './helper';
import CurvePool from './lib/CurvePool';
import { EthereumAddress } from '@thisisarchimedes/backend-sdk';

describe('Unbalance pool', () => {
	let signer: HardhatEthersSigner;
	let curvePool: CurvePool;

	before(async () => {
		signer = await helper.getMainSigner();
		curvePool = await CurvePool.createInstance(signer, new EthereumAddress(CURVE_POOL), new EthereumAddress(ALUSD), new EthereumAddress(FRAXBP));
	});

	it('Unbalance pegged curve pool', async () => {
		await helper.setERC20Balance(new EthereumAddress(signer.address), new EthereumAddress(FRAXBP), curvePool.valueTokenBalance * 5n);

		// Rebalance the pool
		await curvePool.rebalance();

		// Reinit pool balances
		curvePool = await CurvePool.createInstance(signer, new EthereumAddress(CURVE_POOL), new EthereumAddress(ALUSD), new EthereumAddress(FRAXBP));
		await helper.setERC20Balance(new EthereumAddress(signer.address), new EthereumAddress(ALUSD), curvePool.dumpTokenBalance);

		// Assert the pool is roughly balanced
		const alUSDPriceInFRAXBPBefore = await curvePool.getDumpTokenPriceInValueToken();
		assert.approximately(helper.removeDecimals(alUSDPriceInFRAXBPBefore, curvePool.valueTokenDecimals), 1, 0.01, 'Pool is not balanced at start');

		// Unbalance the pool
		await curvePool.unbalance(25);

		// Assert for unbalanced pool
		const alUSDPriceInFRAXBPAfter = await curvePool.getDumpTokenPriceInValueToken();
		assert(helper.removeDecimals(alUSDPriceInFRAXBPAfter, curvePool.valueTokenDecimals) < 0.75, 'Pool is not unbalanced enough');
	});
});
