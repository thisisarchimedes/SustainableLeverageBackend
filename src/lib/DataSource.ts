import {Client, ClientConfig, QueryResult} from 'pg';
import {Logger} from '@thisisarchimedes/backend-sdk';

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
  private logger:Logger;
  constructor(logger:Logger) {
    this.logger = logger;
    this.client = new Client(dbConfig);
    this.client.connect().catch((e)=>{
      this.logger.error((e as Error).message);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async getLivePositions(): Promise<QueryResult<any>> {
    try {
      const resp = await this.client.query('SELECT "nftId" FROM "LeveragePosition" WHERE "positionState" = \'LIVE\'');
      return resp;
    } finally {
      this.client.end().catch((e) => {
        this.logger.error((e as Error).message);
      });
    }
  }
}
