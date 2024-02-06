import { assert } from 'chai';
import DataSource from '../src/lib/DataSource';

describe('DataSource Test', function () {
  let dataSource: DataSource;

  before(function () {
    dataSource = new DataSource();
  });

  it('Check get live positions', async function () {
    const positions = await dataSource.getLivePositions();

    for (const position of positions) {
      const nftId: number = Number(position.nftId);
      assert(nftId >= 0, 'nftId should be greater than 0');
      assert(!isNaN(nftId), 'nftId is not a number');
    }
  });
});
