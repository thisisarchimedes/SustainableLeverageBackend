import { ethers } from "hardhat";
import '@nomicfoundation/hardhat-ethers';
import { MultiPoolStrategy__factory } from '../types/ethers-contracts/factories/scripts/ABIs/MultiPoolStrategy__factory';

async function main() {
  // Get a signer for the impersonated account
  const impersonatedSigner = await ethers.getSigner("0x93B435e55881Ea20cBBAaE00eaEdAf7Ce366BeF2");

  const strategy = MultiPoolStrategy__factory.connect("0xD078a331A8A00AB5391ba9f3AfC910225a78e6A1", impersonatedSigner);

  console.log(await strategy.adjustInInterval());
  console.log(await strategy.owner());

  await strategy.changeAdjustInInterval(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
