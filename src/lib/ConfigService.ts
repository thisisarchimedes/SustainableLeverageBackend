import 'dotenv/config';
import {EthereumAddress, S3Service} from '@thisisarchimedes/backend-sdk';

const s3Service = new S3Service();

export interface Config {
  leveragedStrategy: EthereumAddress;
  positionLedger: EthereumAddress;
  positionLiquidator: EthereumAddress;
  positionExpirator: EthereumAddress;
}

export async function loadConfig(): Promise<Config> {
  // Usage example
  const bucketName = process.env.S3_BUCKET_CONFIG!;
  const keyName = process.env.S3_ADDRESSES_KEY!;

  const addresses = await s3Service.getJsonObject(bucketName, keyName) as [{ address: string, name: string }];

  const config: Config = {
    leveragedStrategy: new EthereumAddress(addresses.filter((obj) => obj.name === 'LeveragedStrategy')[0].address),
    positionLedger: new EthereumAddress(addresses.filter((obj) => obj.name === 'PositionLedger')[0].address),
    positionLiquidator: new EthereumAddress(addresses.filter((obj) => obj.name === 'PositionLiquidator')[0].address),
    positionExpirator: new EthereumAddress(addresses.filter((obj) => obj.name === 'positionExpirator')[0].address),

  };

  return config;
}
