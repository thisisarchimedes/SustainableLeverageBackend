import { ethers, network } from "hardhat";
import '@nomicfoundation/hardhat-ethers';
import { MultiPoolStrategy__factory } from '../types/ethers-contracts/factories/scripts/ABIs/MultiPoolStrategy__factory';
import { FRAXBPALUSD_STRATEGY } from "../test/addresses";

async function main() {
  
  // Get a signer for the impersonated account
  
  const [signer] = await ethers.getSigners();
  let strategy = MultiPoolStrategy__factory.connect(FRAXBPALUSD_STRATEGY, signer);
  
  const strategyOwner = await strategy.owner();
  
  // Get Impersonated Account
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [strategyOwner]
  });
  const impersonatedSigner = await ethers.getSigner(strategyOwner);
  strategy = MultiPoolStrategy__factory.connect(FRAXBPALUSD_STRATEGY, impersonatedSigner);

  console.log(await strategy.adjustInInterval());
  console.log(await strategy.owner());

  await strategy.changeAdjustInInterval(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
