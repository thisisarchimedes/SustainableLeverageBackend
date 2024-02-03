import { assert } from 'chai';
import DataSource from '../src/lib/DataSource';
import { EthereumAddress, Logger } from '@thisisarchimedes/backend-sdk';

describe('DataSource Test', function () {
  let dataSource: DataSource;

  before(() => {
    Logger.initialize("liquidator-bot");
    const logger = Logger.getInstance();
    dataSource = new DataSource(logger);
  });

  it('Check get live positions', async function () {
    const res = await dataSource.getLivePositions();

    for (const row of res.rows) {
      const nftId: number = Number(row.nftId);
      const strategyShares: number = Number(row.strategyShares);
      new EthereumAddress(row.strategy); // Throws on invalid address

      assert(nftId >= 0, 'nftId should be greater or equal 0');
      assert(!isNaN(nftId), 'nftId is not a number');

      assert(strategyShares > 0, 'strategyShares should be greater than 0');
      assert(!isNaN(strategyShares), 'strategyShares is not a number');
    }
  });
});
