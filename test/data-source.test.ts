import { assert } from 'chai';
import DataSource from '../src/lib/DataSource';

describe('DataSource Test', function () {
  let dataSource: DataSource;

  before(() => {
    dataSource = new DataSource();
  });

  it('Check get live positions', async function () {
    const res = await dataSource.getLivePositions();

    for (const row of res.rows) {
      const nftId: number = row.nftId;
      assert(nftId > 0, 'nftId should be greater than 0');
      assert(typeof (nftId) === 'number', 'nftId is not a number');
    }
  });
});
