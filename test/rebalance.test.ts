import { assert } from 'chai';
import '@nomicfoundation/hardhat-ethers';
import { type HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ALUSD, CURVE_POOL, FRAXBP } from './addresses';
import helper from './helper';
import CurvePool from './lib/CurvePool';
import { EthereumAddress } from '@thisisarchimedes/backend-sdk';

describe('Rebalance pool', () => {
	let signer: HardhatEthersSigner;
	let curvePool: CurvePool;

	before(async () => {
		signer = await helper.getMainSigner();
		curvePool = await CurvePool.createInstance(signer, new EthereumAddress(CURVE_POOL), new EthereumAddress(ALUSD), new EthereumAddress(FRAXBP));
	});

	it('Rebalance pegged curve pool', async () => {
		await helper.setERC20Balance(signer.address, ALUSD, curvePool.dumpTokenBalance);

		// Unbalance the pool
		await curvePool.unbalance(25);

		// Reinit pool balances
		curvePool = await CurvePool.createInstance(signer, new EthereumAddress(CURVE_POOL), new EthereumAddress(ALUSD), new EthereumAddress(FRAXBP));
		await helper.setERC20Balance(signer.address, FRAXBP, curvePool.valueTokenBalance * 100n);

		// Assert the pool is unbalanced
		const alUSDPriceInFRAXBPBefore = await curvePool.getDumpTokenPriceInValueToken();
		assert(helper.removeDecimals(alUSDPriceInFRAXBPBefore, curvePool.valueTokenDecimals) < 0.75, 'Pool is not unbalanced at start');

		// Rebalance the pool
		await curvePool.rebalance();

		// Assert for balanced pool
		const alUSDPriceInFRAXBPAfter = await curvePool.getDumpTokenPriceInValueToken();
		assert.approximately(helper.removeDecimals(alUSDPriceInFRAXBPAfter, curvePool.valueTokenDecimals), 1, 0.01, 'Pool did not balance');
	});
});
