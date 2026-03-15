import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "company-applications.json");

export type AppRecord = {
  id: string;
  companyId?: string;
  companySlug?: string;
  name: string;
  slug: string;
  description?: string | null;
  qaseProjectCode?: string | null;
  source?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApplicationsDb = {
  items: AppRecord[];
  counter: number;
};

type ApplicationSeed = Partial<AppRecord> & {
  name: string;
};

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeProjectCode(value: string | null | undefined) {
  const trimmed = value?.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

function readFile(): ApplicationsDb {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ApplicationsDb> | null;
    return {
      items: Array.isArray(parsed?.items) ? (parsed?.items as AppRecord[]) : [],
      counter: typeof parsed?.counter === "number" ? parsed.counter : 0,
    };
  } catch {
    return { items: [], counter: 0 };
  }
}

function writeFile(data: ApplicationsDb) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function listApplications(filter?: { companySlug?: string }) {
  const db = readFile();
  let items: AppRecord[] = db.items || [];
  if (filter?.companySlug) {
    items = items.filter((i) => i.companySlug === filter.companySlug);
  }
  return items;
}

export function createApplication(input: ApplicationSeed) {
  const db = readFile();
  const id = `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const now = new Date().toISOString();
  const qaseProjectCode = normalizeProjectCode(input.qaseProjectCode);
  const record: AppRecord = {
    id,
    companyId: input.companyId ?? input.companySlug ?? undefined,
    companySlug: input.companySlug ?? input.companyId ?? undefined,
    name: input.name || "Untitled",
    slug: normalizeSlug(input.slug || qaseProjectCode || input.name || "untitled"),
    description: input.description ?? null,
    qaseProjectCode,
    source: input.source ?? null,
    active: typeof input.active === "boolean" ? input.active : true,
    createdAt: now,
    updatedAt: now,
  };

  db.items = db.items || [];
  db.items.unshift(record);
  db.counter = (db.counter || 0) + 1;
  writeFile(db);
  return record;
}

export function syncCompanyApplications(input: {
  companyId?: string | null;
  companySlug?: string | null;
  projects: Array<{ code: string; title?: string | null }>;
}) {
  const companySlug = input.companySlug?.trim() || input.companyId?.trim() || undefined;
  const companyId = input.companyId?.trim() || input.companySlug?.trim() || undefined;
  if (!companySlug) return [];

  const db = readFile();
  const now = new Date().toISOString();
  const synced: AppRecord[] = [];

  for (const project of input.projects) {
    const code = normalizeProjectCode(project.code);
    if (!code) continue;

    const slug = normalizeSlug(code);
    const name = (project.title ?? code).trim() || code;
    const idx = db.items.findIndex((item) => {
      if (item.companySlug !== companySlug) return false;
      const sameCode = normalizeProjectCode(item.qaseProjectCode) === code;
      const sameSlug = normalizeSlug(item.slug ?? "") === slug;
      return sameCode || sameSlug;
    });

    if (idx >= 0) {
      const current = db.items[idx];
      const updated: AppRecord = {
        ...current,
        companyId: current.companyId ?? companyId,
        companySlug,
        name,
        slug,
        qaseProjectCode: code,
        source: current.source ?? "qase",
        active: true,
        updatedAt: now,
      };
      db.items[idx] = updated;
      synced.push(updated);
      continue;
    }

    const created: AppRecord = {
      id: `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      companyId,
      companySlug,
      name,
      slug,
      description: null,
      qaseProjectCode: code,
      source: "qase",
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    db.items.unshift(created);
    db.counter = (db.counter || 0) + 1;
    synced.push(created);
  }

  if (synced.length > 0) {
    writeFile(db);
  }

  return synced;
}
