
import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const S3_BUCKET = process.env.S3_BUCKET!;


export async function seedRunsForSearch() {
  // Nome do arquivo no bucket S3
  const s3Key = "releases-manual.json";
  let releases: any[] = [];
  // Tenta baixar o arquivo existente do S3
  try {
    const getObj = await s3.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
    }));
    const stream = getObj.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    releases = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {}
  const runs = [
    {
      id: "run-busca-1",
      slug: "run-busca-1",
      name: "Run Busca Alpha",
      app: "GRIAULE",
      clientSlug: "griaule",
      source: "MANUAL",
      status: "closed",
      stats: { pass: 1, fail: 0, blocked: 0, notRun: 0 },
      closedAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      runSlug: "run-busca-1",
      runName: "Run Busca Alpha"
    },
    {
      id: "run-busca-2",
      slug: "run-busca-2",
      name: "Run Busca Beta",
      app: "GRIAULE",
      clientSlug: "griaule",
      source: "MANUAL",
      status: "closed",
      stats: { pass: 1, fail: 0, blocked: 0, notRun: 0 },
      closedAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      runSlug: "run-busca-2",
      runName: "Run Busca Beta"
    }
  ];
  for (const run of runs) {
    releases = releases.filter((r: any) => r.slug !== run.slug);
    releases.push(run);
  }
  // Salva o arquivo atualizado no S3
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: JSON.stringify(releases, null, 2),
    ContentType: "application/json",
  }));
}

export async function seedRunsWithQuality() {
  const file = path.join(process.cwd(), "data", "releases-manual.json");
  let releases: any[] = [];
  try {
    releases = JSON.parse(await fs.promises.readFile(file, "utf8"));
  } catch {}
  const runs = [
    {
      id: "run-quality-1",
      slug: "run-quality-1",
      name: "Run Qualidade Alta",
      app: "GRIAULE",
      clientSlug: "griaule",
      source: "MANUAL",
      status: "closed",
      stats: { pass: 2, fail: 0, blocked: 0, notRun: 0 },
      closedAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      runSlug: "run-quality-1",
      runName: "Run Qualidade Alta"
    }
  ];
  for (const run of runs) {
    releases = releases.filter((r: any) => r.slug !== run.slug);
    releases.push(run);
  }
  await fs.promises.writeFile(file, JSON.stringify(releases, null, 2), "utf8");
}

export async function seedDefectsOutOfSLA() {
  const file = path.join(process.cwd(), "data", "quality_alerts.json");
  let alerts: any[] = [];
  try {
    alerts = JSON.parse(await fs.promises.readFile(file, "utf8"));
  } catch {}
  const newAlert = {
    companySlug: "griaule",
    type: "sla",
    severity: "critical",
    message: "Defeitos fora do SLA: 2",
    metadata: { slaOverdue: 2 },
    timestamp: new Date().toISOString()
  };
  alerts = alerts.filter((a: any) => !(a.companySlug === newAlert.companySlug && a.type === newAlert.type));
  alerts.push(newAlert);
  await fs.promises.writeFile(file, JSON.stringify(alerts, null, 2), "utf8");
}
