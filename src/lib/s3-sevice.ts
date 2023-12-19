import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

// Create S3 service object
const s3Client = new S3Client();

// Function to get and parse JSON file
export async function getJsonFromS3(bucket: string, key: string): Promise<unknown> {
  const getObjectParams = {
    Bucket: bucket,
    Key: key,
  };

  try {
    const command = new GetObjectCommand(getObjectParams);
    const response = await s3Client.send(command);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const streamToString = (stream: any): Promise<string> =>
      new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
        stream.once("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        stream.once("error", reject);
      });

    if (response.Body) {
      const bodyContents = await streamToString(response.Body);
      return JSON.parse(bodyContents);
    } else {
      throw new Error("Empty response body");
    }
  } catch (err) {
    console.error("Error fetching file from S3:", err);
    throw err;
  }
}
