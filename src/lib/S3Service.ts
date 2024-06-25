import {S3, CopyObjectRequest, GetObjectCommand} from '@aws-sdk/client-s3';

export default class S3Service {
  private readonly s3: S3;

  constructor() {
    this.s3 = new S3();
  }

  async getObject(bucket: string, key: string): Promise<string> {
    const data = await this.s3.getObject({Bucket: bucket, Key: key});
    return await data.Body!.transformToString();
  }

  /**
   * A function to get a JSON object from S3
   * Uses strams to handle large files
   * @param bucket S3 Bucket name
   * @param key S3 Object key
   * @returns Parsed JSON object
   */
  async getJsonObject(bucket: string, key: string): Promise<unknown> {
    const getObjectParams = {
      Bucket: bucket,
      Key: key,
    };

    try {
      const command = new GetObjectCommand(getObjectParams);
      const response = await this.s3.send(command);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const streamToString = (stream: any): Promise<string> =>
        new Promise((resolve, reject) => {
          const chunks: Uint8Array[] = [];
          stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
          stream.once('end', () =>
            resolve(Buffer.concat(chunks).toString('utf-8')),
          );
          stream.once('error', reject);
        });

      if (response.Body) {
        const bodyContents = await streamToString(response.Body);
        return JSON.parse(bodyContents);
      } else {
        throw new Error('Empty response body');
      }
    } catch (err) {
      console.error('Error fetching file from S3:', err);
      throw err;
    }
  }

  async putObject(bucket: string, key: string, body: string): Promise<void> {
    await this.s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: body,
    });
  }

  async copyObject(
      sourceBucket: string,
      sourceKey: string,
      destinationBucket: string,
      destinationKey: string,
  ): Promise<void> {
    const copySource = encodeURI(`/${sourceBucket}/${sourceKey}`);
    const params: CopyObjectRequest = {
      Bucket: destinationBucket,
      CopySource: copySource,
      Key: destinationKey,
    };

    try {
      await this.s3.copyObject(params);
    } catch (err) {
      console.error('Error in copying object:', err);
      throw err;
    }
  }
}
