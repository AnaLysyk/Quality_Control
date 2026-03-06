import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "company-applications.json");

type AppRecord = {
  id: string;
  companyId?: string;
  companySlug?: string;
  name: string;
  slug: string;
  description?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

function readFile() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return { items: [], counter: 0 };
  }
}

function writeFile(data: any) {
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

export function createApplication(input: Partial<AppRecord>) {
  const db = readFile();
  const id = `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const now = new Date().toISOString();
  const record: AppRecord = {
    id,
    companyId: input.companyId ?? input.companySlug ?? undefined,
    companySlug: input.companySlug ?? input.companyId ?? undefined,
    name: input.name || "Untitled",
    slug: input.slug || (input.name || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    description: input.description ?? null,
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
