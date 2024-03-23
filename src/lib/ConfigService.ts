import 'dotenv/config';
import {EthereumAddress, S3Service} from '@thisisarchimedes/backend-sdk';

const s3Service = new S3Service();

export interface Config {
  leveragedStrategy: EthereumAddress;
  positionLedger: EthereumAddress;
  positionLiquidator: EthereumAddress;
  positionOpener: EthereumAddress;
  positionCloser: EthereumAddress;
  positionToken: EthereumAddress;
  wbtcVault: EthereumAddress;
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
    positionOpener: new EthereumAddress(addresses.filter((obj) => obj.name === 'PositionOpener')[0].address),
    positionCloser: new EthereumAddress(addresses.filter((obj) => obj.name === 'PositionCloser')[0].address),
    positionToken: new EthereumAddress(addresses.filter((obj) => obj.name === 'PositionToken')[0].address),
    wbtcVault: new EthereumAddress(addresses.filter((obj) => obj.name === 'wbtcVault')[0].address),
  };

  return config;
}
