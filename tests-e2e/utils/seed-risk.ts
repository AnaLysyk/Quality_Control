import fs from "fs";
import path from "path";

export async function seedReleaseWithHighMTTR() {
  const file = path.join(process.cwd(), "data", "releases-manual.json");
  let releases: any[] = [];
  try {
    releases = JSON.parse(await fs.promises.readFile(file, "utf8"));
  } catch {}
  const mttrRisk = {
    id: "mttr-risk-1",
    slug: "mttr-risk-1",
    name: "Release MTTR Alto",
    app: "GRIAULE",
    clientSlug: "griaule",
    source: "MANUAL",
    status: "closed",
    stats: { pass: 1, fail: 0, blocked: 0, notRun: 0 },
    closedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    runSlug: "mttr-risk-1",
    runName: "Release MTTR Alto"
  };
  releases = releases.filter((r: any) => r.slug !== mttrRisk.slug);
  releases.push(mttrRisk);
  await fs.promises.writeFile(file, JSON.stringify(releases, null, 2), "utf8");
}

export async function seedReleaseWithFailedRun() {
  const file = path.join(process.cwd(), "data", "releases-manual.json");
  let releases: any[] = [];
  try {
    releases = JSON.parse(await fs.promises.readFile(file, "utf8"));
  } catch {}
  const runRisk = {
    id: "run-risk-1",
    slug: "run-risk-1",
    name: "Release com Run Falha",
    app: "GRIAULE",
    clientSlug: "griaule",
    source: "MANUAL",
    status: "closed",
    stats: { pass: 0, fail: 1, blocked: 0, notRun: 0 },
    closedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    runSlug: "run-risk-1",
    runName: "Release com Run Falha"
  };
  releases = releases.filter((r: any) => r.slug !== runRisk.slug);
  releases.push(runRisk);
  await fs.promises.writeFile(file, JSON.stringify(releases, null, 2), "utf8");
}
