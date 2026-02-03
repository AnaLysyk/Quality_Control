import fs from "fs";
import { resolveSeedPath } from "./seed-paths";

type ManualRelease = {
  slug?: string | null;
} & Record<string, unknown>;

type ManualCase = Record<string, unknown>;

export async function seedRunWithDefects() {
  // Seed para releases-manual.json (run)
  const releasesFile = resolveSeedPath("releases-manual.json");
  let releases: ManualRelease[] = [];
  try {
    releases = JSON.parse(await fs.promises.readFile(releasesFile, "utf8"));
  } catch {}
  const defectRun = {
    id: "run-defeito-1",
    slug: "run-defeito-1",
    name: "Run com Defeitos Unico",
    app: "GRIAULE",
    kind: "run",
    clientSlug: "griaule",
    source: "MANUAL",
    status: "closed",
    stats: { pass: 1, fail: 1, blocked: 0, notRun: 0 },
    closedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    runSlug: "run-defeito-1",
    runName: "Run com Defeitos Unico"
  };
  releases = releases.filter((r) => r.slug !== defectRun.slug);
  releases.push(defectRun);
  await fs.promises.writeFile(releasesFile, JSON.stringify(releases, null, 2), "utf8");

  // Seed para releases-manual-cases.json (defeitos filtrados)
  const casesFile = resolveSeedPath("releases-manual-cases.json");
  let cases: Record<string, ManualCase[]> = {};
  try {
    cases = JSON.parse(await fs.promises.readFile(casesFile, "utf8"));
  } catch {}
  cases["run-defeito-1"] = [
    {
      id: "defeito-filtrado-1",
      title: "Defeito filtrado 1",
      bug: null,
      dbId: null,
      link: "",
      fromApi: false,
      status: "fail"
    },
    {
      id: "defeito-filtrado-2",
      title: "Defeito filtrado 2",
      bug: null,
      dbId: null,
      link: "",
      fromApi: false,
      status: "fail"
    },
    // Add 'Defeito proibido' for RBAC test
    {
      id: "defeito_proibido",
      title: "Defeito proibido Unico",
      bug: null,
      dbId: null,
      link: "",
      fromApi: false,
      status: "fail"
    }
  ];
  // Also ensure at least one defect for mttr-test-1 for drilldown
  cases["mttr-test-1"] = [
    {
      id: "defeito-mttr-1",
      title: "Defeito MTTR Drilldown",
      bug: null,
      dbId: null,
      link: "",
      fromApi: false,
      status: "fail"
    }
  ];
  await fs.promises.writeFile(casesFile, JSON.stringify(cases, null, 2), "utf8");
}
