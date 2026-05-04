import "server-only";
import fs from "fs";
import path from "path";
import { canUsePersistentJsonStore, readPersistentJson, writePersistentJson } from "@/lib/persistentJsonStore";
import { slugifyRelease } from "@/lib/slugifyRelease";
import type { ReleaseStatus } from "@/types/release";

export type ReleaseEntry = {
  slug: string;
  title: string;
  summary: string;
  runId: number;
  project: string;
  app?: string;
  radis?: string;
  qaseProject?: string;
  order?: string[];
  createdAt?: string;
  source?: "MANUAL" | "API";
  status?: ReleaseStatus | "EM_ANDAMENTO" | "FINALIZADA";
  environments?: string[];
  manualSummary?: { pass: number; fail: number; blocked: number; notRun: number };
  metrics?: { pass?: number; fail?: number; blocked?: number; not_run?: number; notRun?: number };
  created_at?: string;
  clientId?: string | null;
  clientName?: string | null;
  assignees?: string[];
  assigneeNames?: string[];
};

const staticReleaseOrder = [
  "v1_8_0_reg",
  "v1_8_0_ace",
  "v1_7_0_reg",
  "v1_7_0_ace_s3",
  "v1_7_0_ace_s12",
  "v1_6_2_reg",
  "v1_6_2_ace",
  "print_v1_8_0_ace",
  "release_1_teste_painel_qa_ace",
] as const;

export type ReleaseId = (typeof staticReleaseOrder)[number];

const staticReleasesMap: Record<ReleaseId, Omit<ReleaseEntry, "slug">> = {
  v1_8_0_reg: {
    title: "Release 1.8.0 - Regressao",
    summary: "Execução completa do ciclo de regressao 1.8.0.",
    runId: 17,
    project: "smart",
    app: "smart",
    qaseProject: "SFQ",
    radis: "RADIS_1",
    order: ["smart"],
    createdAt: "2025-11-19T00:00:00.000Z",
  },
  v1_8_0_ace: {
    title: "Release 1.8.0 - Aceitacao",
    summary: "Validacoes de aceitacao para a 1.8.0.",
    runId: 15,
    project: "smart",
    app: "smart",
    qaseProject: "SFQ",
    radis: "RADIS_1",
    order: ["smart"],
    createdAt: "2025-10-24T00:00:00.000Z",
  },
  v1_7_0_reg: {
    title: "Release 1.7.0 - Regressao",
    summary: "Execução completa do ciclo de regressao 1.7.0.",
    runId: 14,
    project: "smart",
    app: "smart",
    qaseProject: "SFQ",
    radis: "RADIS_1",
    order: ["smart"],
    createdAt: "2025-10-17T00:00:00.000Z",
  },
  v1_7_0_ace_s3: {
    title: "Release 1.7.0 - Aceitacao (Sprint 3)",
    summary: "Execução de aceitacao sprint 3 da 1.7.0.",
    runId: 12,
    project: "smart",
    app: "smart",
    qaseProject: "SFQ",
    radis: "RADIS_1",
    order: ["smart"],
    createdAt: "2025-09-16T00:00:00.000Z",
  },
  v1_7_0_ace_s12: {
    title: "Release 1.7.0 - Aceitacao (Sprint 1/2)",
    summary: "Execução de aceitacao sprint 1/2 da 1.7.0.",
    runId: 11,
    project: "smart",
    app: "smart",
    qaseProject: "SFQ",
    radis: "RADIS_1",
    order: ["smart"],
    createdAt: "2025-09-01T00:00:00.000Z",
  },
  v1_6_2_reg: {
    title: "Release 1.6.2 - Regressao",
    summary: "Execução de regressao da release base 1.6.2.",
    runId: 10,
    project: "smart",
    app: "smart",
    qaseProject: "SFQ",
    radis: "RADIS_1",
    order: ["smart"],
    createdAt: "2025-08-11T00:00:00.000Z",
  },
  v1_6_2_ace: {
    title: "Release 1.6.2 - Aceitacao",
    summary: "Plano de aceitacao da release base 1.6.2.",
    runId: 10,
    project: "smart",
    app: "smart",
    qaseProject: "SFQ",
    radis: "RADIS_1",
    order: ["smart"],
    createdAt: "2025-07-31T00:00:00.000Z",
  },
  print_v1_8_0_ace: {
    title: "Release 1.8.0 - Aceitacao (PRINT)",
    summary: "Execução da aceitacao do PRINT na release 1.8.0.",
    runId: 3,
    project: "print",
    app: "print",
    qaseProject: "PRINT",
    radis: "RADIS_1",
    order: ["print"],
    createdAt: "2025-11-01T00:00:00.000Z",
  },
  release_1_teste_painel_qa_ace: {
    title: "Release 1 Quality Control - Aceitacao",
    summary: "Execução do Quality Control - GMT Mobile (run: https://app.qase.io/run/GMT/dashboard/1) - Aceitacao",
    runId: 1,
    project: "gmt",
    app: "gmt",
    qaseProject: "GMT",
    radis: "RADIS_1",
    order: ["gmt"],
    createdAt: "2025-12-01T00:00:00.000Z",
  },
};

export const releaseOrder = staticReleaseOrder;

export const releasesData: Record<ReleaseId, Omit<ReleaseEntry, "slug">> = staticReleasesMap;

const STORE_PATH = path.join(process.cwd(), "data", "releases-store.json");
const STORE_KEY = "qc:releases_store:v1";
const USE_PERSISTENT_STORE = canUsePersistentJsonStore();

async function ensureStoreFile() {
  if (USE_PERSISTENT_STORE) return;
  await fs.promises.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.promises.access(STORE_PATH, fs.constants.F_OK);
  } catch {
    await fs.promises.writeFile(STORE_PATH, "[]", "utf8");
  }
}

export async function readReleaseStore(): Promise<ReleaseEntry[]> {
  if (USE_PERSISTENT_STORE) {
    const persisted = await readPersistentJson<ReleaseEntry[]>(STORE_KEY, []);
    return Array.isArray(persisted) ? persisted.filter(Boolean) : [];
  }
  try {
    await ensureStoreFile();
    const raw = await fs.promises.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as ReleaseEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean);
  } catch {
    return [];
  }
}

export async function writeReleaseStore(entries: ReleaseEntry[]) {
  if (USE_PERSISTENT_STORE) {
    const ok = await writePersistentJson(STORE_KEY, entries);
    if (ok) return;
  }
  await ensureStoreFile();
  await fs.promises.writeFile(STORE_PATH, JSON.stringify(entries, null, 2), "utf8");
}

export async function getAllReleases(): Promise<ReleaseEntry[]> {
  const persisted = await readReleaseStore();
  const merged = new Map<string, ReleaseEntry>();
  const baseDate = new Date(Date.UTC(2024, 0, 1)).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  Object.entries(staticReleasesMap).forEach(([slug, entry]) => {
    const app = entry.app ?? entry.project ?? "smart";
    const created =
      entry.createdAt ??
      new Date(baseDate + (entry.runId ?? 0) * dayMs).toISOString();
    merged.set(slug, {
      slug,
      ...entry,
      app,
      project: entry.project ?? app,
      order: entry.order ?? [app],
      createdAt: created,
    });
  });

  persisted.forEach((entry) => {
    const normalizedSlug = slugifyRelease(entry.slug || entry.title);
    const app = entry.app ?? entry.project ?? "smart";
    const order = (entry.order ?? []).filter(Boolean);
    const created =
      entry.createdAt ??
      new Date(baseDate + (entry.runId ?? 0) * dayMs).toISOString();
    merged.set(normalizedSlug, {
      ...entry,
      slug: normalizedSlug,
      app,
      project: entry.project ?? app,
      order: order.length ? order : [app],
      createdAt: created,
    });
  });

  return Array.from(merged.values());
}

export async function getReleaseBySlug(slug: string): Promise<ReleaseEntry | undefined> {
  const all = await getAllReleases();
  const target = slugifyRelease(slug);
  return all.find((release) => release.slug === target);
}

export async function upsertRelease(entry: Omit<ReleaseEntry, "slug"> & { slug?: string }) {
  const slug = slugifyRelease(entry.slug || entry.title);
  const nowIso = new Date().toISOString();
  const payload: ReleaseEntry = {
    ...entry,
    slug,
    app: entry.app ?? entry.project,
    project: entry.project ?? entry.app ?? "smart",
    qaseProject: entry.qaseProject ?? (entry.project === "smart" ? "SFQ" : entry.project?.toUpperCase()),
    createdAt: entry.createdAt,
    clientId: entry.clientId ?? null,
    clientName: entry.clientName ?? null,
    assignees: Array.isArray(entry.assignees) ? entry.assignees.filter(Boolean) : undefined,
    assigneeNames: Array.isArray(entry.assigneeNames) ? entry.assigneeNames.filter(Boolean) : undefined,
  };
  const current = await readReleaseStore();
  const existing = current.find((item) => item.slug === slug);
  const app = payload.app ?? payload.project ?? "smart";
  const order = (payload.order ?? existing?.order ?? []).filter(Boolean);

  const finalPayload: ReleaseEntry = {
    ...payload,
    createdAt: existing?.createdAt ?? payload.createdAt ?? nowIso,
    order: order.length ? order : [app],
    assignees: payload.assignees ?? existing?.assignees,
    assigneeNames: payload.assigneeNames ?? existing?.assigneeNames,
    clientId: payload.clientId ?? existing?.clientId ?? null,
    clientName: payload.clientName ?? existing?.clientName ?? null,
  };

  const filtered = current.filter((item) => item.slug !== slug);
  filtered.push(finalPayload);
  await writeReleaseStore(filtered);
  return finalPayload;
}

export async function deleteReleaseFromStore(slug: string) {
  const current = await readReleaseStore();
  const filtered = current.filter((item) => item.slug !== slug);
  await writeReleaseStore(filtered);
  return filtered.length !== current.length;
}

export async function updateReleaseOrder(slug: string, order: string[]) {
  const normalizedSlug = slugifyRelease(slug);
  const current = await readReleaseStore();
  const target = current.find((item) => slugifyRelease(item.slug) === normalizedSlug);
  if (!target) {
    return undefined;
  }

  const sanitizedOrder = Array.isArray(order)
    ? order.map((value) => value?.toString().trim()).filter(Boolean)
    : [];
  const app = target.app ?? target.project ?? "smart";

  const updated: ReleaseEntry = {
    ...target,
    createdAt: target.createdAt ?? new Date().toISOString(),
    order: sanitizedOrder.length ? sanitizedOrder : [app],
  };

  const filtered = current.filter((item) => slugifyRelease(item.slug) !== normalizedSlug);
  filtered.push(updated);
  await writeReleaseStore(filtered);
  return updated;
}
