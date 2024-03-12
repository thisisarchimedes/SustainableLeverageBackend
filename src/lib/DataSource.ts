import {Logger} from '@thisisarchimedes/backend-sdk';
import {Pool, PoolConfig, QueryResult} from 'pg';
import LeveragePosition from '../types/LeveragePosition';

// RDS database configuration
const dbConfig: PoolConfig = {
  user: process.env.DB_USER!,
  host: process.env.DB_HOST!,
  database: process.env.DB_NAME!,
  password: process.env.DB_PASSWORD!,
  port: Number(process.env.DB_PORT!),
  ssl: {
    rejectUnauthorized: false,
  },
  // Additional pool configuration can be added here
};

export default class DataSource {
  private pool: Pool;
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
    this.pool = new Pool(dbConfig);
    this.pool.on('error', (err) => {
      this.logger.error(`Unexpected error on idle client ${(err as Error).message}`);
      process.exit(-1);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async executeQuery(query: string | { text: string, values: any[] }): Promise<QueryResult> {
    let client;
    try {
      client = await this.pool.connect();
      return await client.query(query);
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  public async getPositionsByNftIds(nftIds: number[]): Promise<LeveragePosition[]> {
    const query = {
      text: 'SELECT * FROM "LeveragePosition" WHERE "nftId" = ANY($1::int[])',
      values: [nftIds],
    };
    const resp = await this.executeQuery(query);
    return resp.rows as LeveragePosition[];
  }

  public async getLivePositions(): Promise<LeveragePosition[]> {
    const resp = await this.executeQuery('SELECT * FROM "LeveragePosition" WHERE "positionState" = \'LIVE\' LIMIT 1000');
    return resp.rows as LeveragePosition[];
  }

  public async getLivePositionsNftIds(): Promise<number[]> {
    const resp = await this.executeQuery('SELECT "nftId" FROM "LeveragePosition" WHERE "positionState" = \'LIVE\'');
    return resp.rows.map((row) => row.nftId);
  }
}
