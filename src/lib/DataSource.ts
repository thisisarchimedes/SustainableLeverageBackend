import { Logger } from "@thisisarchimedes/backend-sdk";
import { Client, ClientConfig, QueryResult } from "pg";

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
  constructor(logger: Logger) {
    this.client = new Client(dbConfig);
    this.client.connect().catch((error) => logger.error(JSON.stringify(error)));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getLivePositions(): Promise<QueryResult<any>> {
    const resp = this.client.query('SELECT "nftId", "strategy", "strategyShares" FROM "LeveragePosition" WHERE "positionState" = \'LIVE\'');
    return resp;
  }
}