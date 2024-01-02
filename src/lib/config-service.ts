import { getJsonFromS3 } from "./s3-sevice";
import "dotenv/config";
import { EthereumAddress } from "@thisisarchimedes/backend-sdk";

export interface Config {
  leveragedStrategy: EthereumAddress;
  positionLedger: EthereumAddress;
  positionLiquidator: EthereumAddress;
}

export async function loadConfig(): Promise<Config> {
  // Usage example
  const bucketName = process.env.S3_BUCKET_CONFIG!;
  const keyName = process.env.S3_ADDRESSES_KEY!;

  const addresses = await getJsonFromS3(bucketName, keyName) as [{ address: string, name: string }];

  const config: Config = {
    leveragedStrategy: new EthereumAddress(addresses.filter(obj => obj.name === 'LeveragedStrategy')[0].address),
    positionLedger: new EthereumAddress(addresses.filter(obj => obj.name === 'PositionLedger')[0].address),
    positionLiquidator: new EthereumAddress(addresses.filter(obj => obj.name === 'PositionLiquidator')[0].address),
  };

  return config;
}