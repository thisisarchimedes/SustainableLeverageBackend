import { type HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';

const config: HardhatUserConfig = {
	solidity: '0.8.21',
	networks: {
		hardhat: {
			forking: {
				url: 'http://ec2-52-4-114-208.compute-1.amazonaws.com:8545',
				blockNumber: 18820117
			}
		},
		external: {
			url: 'http://ec2-52-4-114-208.compute-1.amazonaws.com:8545',
			chainId: 31337
		},
		localhost: {
			url: "http://127.0.0.1:8545"
		}
	}
};

export default config;
