import {ethers, network} from 'hardhat';
import '@nomicfoundation/hardhat-ethers';
import {FRAXBPALUSD_STRATEGY} from '../test/lib/addresses';
import {MultiPoolStrategy__factory} from '../src/types/leverage-contracts/factories/MultiPoolStrategy__factory';

async function main() {
  // Get a signer for the impersonated account
  const [signer] = await ethers.getSigners();
  let strategy = MultiPoolStrategy__factory.connect(FRAXBPALUSD_STRATEGY, signer);  ;

  const strategyOwner = await strategy.owner();

  // Get Impersonated Account
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [strategyOwner],
  });
  await network.provider.request({
    method: 'hardhat_setBalance',
    params: [strategyOwner, '0xDE0B6B3A76400000'],
  });
  const impersonatedSigner = await ethers.getSigner(strategyOwner);
  strategy = MultiPoolStrategy__factory.connect(FRAXBPALUSD_STRATEGY, impersonatedSigner);  ;

  console.log(await strategy.adjustInInterval());
  console.log(strategyOwner);

  await strategy.changeAdjustInInterval(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
