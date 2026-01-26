import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

async function testS3Connection() {
  try {
    const result = await s3.send(new ListBucketsCommand({}));
    console.log("Conexão S3 bem-sucedida! Buckets:", result.Buckets);
  } catch (err) {
    console.error("Erro ao conectar no S3:", err);
  }
}

testS3Connection();
