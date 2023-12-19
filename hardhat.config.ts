import { type HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';

const config: HardhatUserConfig = {
	solidity: '0.8.19',
	networks: {
		hardhat: {
			forking: {
				url: 'http://ec2-52-90-97-121.compute-1.amazonaws.com:8545',
			},
		},
		localhost: {
			url: "http://127.0.0.1:8545",
		}
	},
};

export default config;
