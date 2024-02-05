import {type HardhatUserConfig} from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import 'dotenv/config';
import 'solidity-coverage';

const config: HardhatUserConfig = {
	solidity: '0.8.21',
	mocha: {
		timeout: 300000
	},
	networks: {
		hardhat: {
			forking: {
				url: process.env.RPC_URL!
			}
		},
		external: {
			url: process.env.RPC_URL!,
			chainId: 31337
		},
		localhost: {
			url: "http://127.0.0.1:8545"
		}
	}
};

export default config;
