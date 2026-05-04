
import fs from "fs";
import path from "path";
import { resolveSeedPath } from "./seed-paths";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type ManualRelease = {
  slug?: string | null;
} & Record<string, unknown>;

type QualityAlert = {
  companySlug: string;
  type: string;
} & Record<string, unknown>;

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
  let releases: ManualRelease[] = [];
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
    releases = JSON.parse(Buffer.concat(chunks).toString("utf8")) as ManualRelease[];
  } catch {}
  const runs = [
    {
      id: "run-busca-1",
      slug: "run-busca-1",
      name: "Run Busca Alpha",
      app: "DEMO",
      kind: "run",
      clientSlug: "DEMO",
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
      app: "DEMO",
      kind: "run",
      clientSlug: "DEMO",
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
    releases = releases.filter((r) => r.slug !== run.slug);
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
  const file = resolveSeedPath("releases-manual.json");
  let releases: ManualRelease[] = [];
  try {
    releases = JSON.parse(await fs.promises.readFile(file, "utf8")) as ManualRelease[];
  } catch {}
  const runs = [
    {
      id: "run-quality-1",
      slug: "run-quality-1",
      name: "Run Qualidade Alta",
      app: "DEMO",
      kind: "run",
      clientSlug: "DEMO",
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
    releases = releases.filter((r) => r.slug !== run.slug);
    releases.push(run);
  }
  await fs.promises.writeFile(file, JSON.stringify(releases, null, 2), "utf8");
}

export async function seedDefectsOutOfSLA() {
  const file = path.join(process.cwd(), "data", "quality_alerts.json");
  let alerts: QualityAlert[] = [];
  try {
    alerts = JSON.parse(await fs.promises.readFile(file, "utf8")) as QualityAlert[];
  } catch {}
  const newAlert = {
    companySlug: "DEMO",
    type: "sla",
    severity: "critical",
    message: "Defeitos fora do SLA: 2",
    metadata: { slaOverdue: 2 },
    timestamp: new Date().toISOString()
  };
  alerts = alerts.filter((a) => !(a.companySlug === newAlert.companySlug && a.type === newAlert.type));
  alerts.push(newAlert);
  await fs.promises.writeFile(file, JSON.stringify(alerts, null, 2), "utf8");
}
