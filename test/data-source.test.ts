import {assert} from 'chai';
import DataSource from '../src/lib/DataSource';
import {EthereumAddress, Logger} from '@thisisarchimedes/backend-sdk';

describe('DataSource Test', function() {
  let dataSource: DataSource;

  before(function() {
    Logger.initialize('liquidator-bot');
  });

  beforeEach(function() {
    dataSource = new DataSource();
  });

  it('Check get live positions', async function() {
    const positions = await dataSource.getLivePositions();

    for (const position of positions) {
      const nftId: number = Number(position.nftId);
      const strategyShares: number = Number(position.strategyShares);
      new EthereumAddress(position.strategy); // Throws on invalid address

      assert(nftId >= 0, 'nftId should be greater or equal 0');
      assert(!isNaN(nftId), 'nftId is not a number');

      assert(strategyShares > 0, 'strategyShares should be greater than 0');
      assert(!isNaN(strategyShares), 'strategyShares is not a number');
    }
  });
});
