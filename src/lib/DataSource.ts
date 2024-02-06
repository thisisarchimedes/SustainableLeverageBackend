import { Client, ClientConfig, QueryResult } from 'pg';
import LeveragePosition from '../types/LeveragePosition'
import { Logger } from '@thisisarchimedes/backend-sdk';

// RDS database configuration
const dbConfig: ClientConfig = {
  user: process.env.DB_USER!,
  host: process.env.DB_HOST!,
  database: process.env.DB_NAME!,
  password: process.env.DB_PASSWORD!,
  port: Number(process.env.DB_PORT!),
  ssl: {
    rejectUnauthorized: false,
  },
};

export default class DataSource {
  private client: Client;
  private logger: Logger;
  constructor() {
    this.logger = Logger.getInstance();
    this.client = new Client(dbConfig);
    this.client.connect().catch((e) => {
      this.logger.error((e as Error).message);
    });
  }

  private async executeQuery(query: string | { text: string, values: any[] }): Promise<QueryResult> {
    try {
      return await this.client.query(query);
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    } finally {
      this.client.end().catch((e) => {
        this.logger.error((e as Error).message);
      });
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
    const resp = await this.executeQuery('SELECT * FROM "LeveragePosition" WHERE "positionState" = \'LIVE\'');
    return resp.rows as LeveragePosition[];
  }

  public async getLivePositionsNftIds(): Promise<number[]> {
    const resp = await this.executeQuery('SELECT "nftId" FROM "LeveragePosition" WHERE "positionState" = \'LIVE\'');
    return resp.rows.map(row => row.nftId);
  }
}