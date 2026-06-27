import "dotenv/config";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";

export const s3Client = new S3Client({ region: config.s3.region });

export function buildDocumentKey(fileName) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${config.s3.uploadPrefix}${Date.now()}-${safeName}`;
}

export async function createUploadUrl({ key, contentType }) {
  const command = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    ContentType: contentType
  });

  return getSignedUrl(s3Client, command, { expiresIn: 900 });
}

export async function createDownloadUrl(key) {
  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key
  });

  return getSignedUrl(s3Client, command, { expiresIn: 900 });
}

export async function readTextObject(key) {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: config.s3.bucket,
      Key: key
    })
  );

  return response.Body.transformToString();
}
