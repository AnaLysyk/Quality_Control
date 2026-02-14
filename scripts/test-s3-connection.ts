/**
 * scripts/test-s3-connection.ts
 * Testa conexão S3 usando variáveis de ambiente.
 * Uso: npx tsx scripts/test-s3-connection.ts
 */

import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Variável de ambiente obrigatória não definida: ${name}`);
    process.exit(2);
  }
  return value;
}

const s3 = new S3Client({
  region: requireEnv("S3_REGION"),
  endpoint: requireEnv("S3_ENDPOINT"),
  credentials: {
    accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
  },
  forcePathStyle: true,
});

/**
 * Testa a conexão S3 e lista buckets.
 */
async function testS3Connection() {
  try {
    const result = await s3.send(new ListBucketsCommand({}));
    console.log("Conexão S3 bem-sucedida! Buckets:", result.Buckets);
    process.exit(0);
  } catch (err) {
    console.error("Erro ao conectar no S3:", err instanceof Error ? err.stack || err.message : err);
    process.exit(1);
  }
}

testS3Connection();
