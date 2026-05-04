import fs from "fs";
import path from "path";
import { resolveSeedPath } from "./seed-paths";

type ManualRelease = {
  slug?: string | null;
} & Record<string, unknown>;

type QualityGoalMeta = {
  company_slug: string;
  goal: string;
} & Record<string, unknown>;

export async function seedMTTRDashboard() {
  const file = resolveSeedPath("releases-manual.json");
  let releases: ManualRelease[] = [];
  try {
    releases = JSON.parse(await fs.promises.readFile(file, "utf8"));
  } catch {}
  const mttrReleases = [
    {
      id: "mttr-test-1",
      slug: "mttr-test-1",
      name: "Release MTTR Dashboard",
      app: "DEMO",
      kind: "defect",
      clientSlug: "DEMO",
      source: "MANUAL",
      status: "closed",
      stats: { pass: 1, fail: 0, blocked: 0, notRun: 0 },
      closedAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      runSlug: "mttr-test-1",
      runName: "Release MTTR Dashboard"
    },
    {
      id: "mttr-manual-unique",
      slug: "mttr-manual-unique",
      name: "Release MTTR Manual Unique",
      app: "DEMO",
      kind: "defect",
      clientSlug: "DEMO",
      source: "MANUAL",
      status: "closed",
      stats: { pass: 0, fail: 1, blocked: 0, notRun: 0 },
      closedAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - 43200000).toISOString(),
      updatedAt: new Date().toISOString(),
      runSlug: "mttr-manual-unique",
      runName: "Release MTTR Manual Unique"
    }
  ];
  // Remove any with same slug, then add/replace
  for (const mttr of mttrReleases) {
    releases = releases.filter((r) => r.slug !== mttr.slug);
    releases.push(mttr);
  }
  await fs.promises.writeFile(file, JSON.stringify(releases, null, 2), "utf8");
}

export async function seedQualityGoalStatus() {
  const file = path.join(process.cwd(), "data", "quality_goal_status.json");
  let metas: QualityGoalMeta[] = [];
  try {
    metas = JSON.parse(await fs.promises.readFile(file, "utf8"));
  } catch {}
  const newMetas = [
    {
      company_slug: "DEMO",
      goal: "coverage",
      status: "violated",
      value: 60,
      target: 80,
      evaluated_at: new Date().toISOString()
    },
    {
      company_slug: "DEMO",
      goal: "mttr",
      status: "at_risk",
      value: 3,
      target: 2,
      evaluated_at: new Date().toISOString()
    }
  ];
  for (const meta of newMetas) {
    metas = metas.filter((m) => !(m.company_slug === meta.company_slug && m.goal === meta.goal));
    metas.push(meta);
  }
  await fs.promises.writeFile(file, JSON.stringify(metas, null, 2), "utf8");
}
