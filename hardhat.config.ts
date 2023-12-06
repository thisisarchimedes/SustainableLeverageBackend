import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks:{
    hardhat:{
      forking:{
        url:"https://eth-mainnet.g.alchemy.com/v2/6k1zoPGPM7goxf3Vtzmz4iILuWbTff85"
      }
    }
  }
};

export default config;
