import { getJsonFromS3 } from "./s3-sevice";
import { type Address } from "../../types/common";
import "dotenv/config";

export interface Config {
  leveragedStrategy: Address;
  positionLiquidator: Address;
}

export async function loadConfig(): Promise<Config> {
  // Usage example
  const bucketName = process.env.S3_BUCKET_CONFIG!;
  const keyName = process.env.S3_ADDRESSES_KEY!;

  const addresses = await getJsonFromS3(bucketName, keyName) as [{ address: Address, name: string }];

  const config: Config = {
    leveragedStrategy: addresses.filter(obj => obj.name === 'LeveragedStrategy')[0].address,
    positionLiquidator: addresses.filter(obj => obj.name === 'PositionLiquidator')[0].address,
  };

  return config;
}