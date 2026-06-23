import { S3Client } from '@aws-sdk/client-s3'

let _client: S3Client | null = null

export const getB2Client = () => {
  if (_client) return _client
  const config = useRuntimeConfig()
  _client = new S3Client({
    region: config.b2Region,
    endpoint: config.b2Endpoint,
    credentials: {
      accessKeyId: config.public.b2KeyId,
      secretAccessKey: config.b2AppKey,
    },
  })
  return _client
}