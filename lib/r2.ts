import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { env } from "@/lib/env"

// Build credentials only when keys are present — avoids TS error about undefined
const credentials =
  env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY
    ? {
        accessKeyId: env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
      }
    : undefined

const S3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID ?? "placeholder"}.r2.cloudflarestorage.com`,
  credentials,
})

const BUCKET_NAME = env.R2_BUCKET_NAME ?? ""

export async function generatePresignedPutUrl(key: string, contentType: string, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  })

  return await getSignedUrl(S3, command, { expiresIn })
}

export async function generatePresignedGetUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  return await getSignedUrl(S3, command, { expiresIn })
}
