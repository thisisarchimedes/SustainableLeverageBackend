import 'dotenv/config';
import S3Service from './S3Service';

const s3Service = new S3Service();

export interface Config {
  leveragedStrategy: string;
  positionLedger: string;
  positionLiquidator: string;
  positionOpener: string;
  positionCloser: string;
  positionToken: string;
  wbtcVault: string;
}

export async function loadConfig(): Promise<Config> {
  // Usage example
  const bucketName = process.env.S3_BUCKET_CONFIG!;
  const keyName = process.env.S3_ADDRESSES_KEY!;

  const addresses = await s3Service.getJsonObject(bucketName, keyName) as [{ address: string, name: string }];

  const config: Config = {
    leveragedStrategy: addresses.filter((obj) => obj.name === 'LeveragedStrategy')[0].address,
    positionLedger: addresses.filter((obj) => obj.name === 'PositionLedger')[0].address,
    positionLiquidator: addresses.filter((obj) => obj.name === 'PositionLiquidator')[0].address,
    positionOpener: addresses.filter((obj) => obj.name === 'PositionOpener')[0].address,
    positionCloser: addresses.filter((obj) => obj.name === 'PositionCloser')[0].address,
    positionToken: addresses.filter((obj) => obj.name === 'PositionToken')[0].address,
    wbtcVault: addresses.filter((obj) => obj.name === 'wbtcVault')[0].address,
  };

  return config;
}
