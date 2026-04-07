import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { isCompanyUser } from "@/lib/rbac/companyAccess";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { normalizeDefectStatus, resolveClosedAt } from "@/lib/defectNormalization";
import { getAllReleases } from "@/release/data";

const QASE_BASE_URL = (process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
const QASE_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";

const PROJECTS_FALLBACK = (process.env.NEXT_PUBLIC_QASE_PROJECTS || process.env.QASE_PROJECTS || "SFQ,PRINT,BOOKING,CDS,GMT")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeProjectCode(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
}

type Defect = {
  id: number;
  title: string;
  name: string;
  status?: string;
  severity?: string | number;
  description?: string;
  project?: string;
  project_code?: string;
  source?: "QASE";
  origin?: "qase";
  run_id?: number | null;
  runId?: number | null;
  runSlug?: string | null;
  runName?: string | null;
  url?: string;
  externalUrl?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  closedAt?: string | null;
};

function normalizeNumericId(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type ReleaseRunLookup = {
  slug: string;
  title: string | null;
};

function buildReleaseRunLookup(projectCodes: string[]) {
  const normalizedProjects = new Set(
    projectCodes
      .map((value) => normalizeProjectCode(value))
      .filter((value): value is string => Boolean(value)),
  );

  return getAllReleases().then((releases) => {
    const lookup = new Map<string, ReleaseRunLookup>();

    for (const release of releases) {
      const projectCode = normalizeProjectCode(release.qaseProject ?? release.project ?? release.app);
      const runId = normalizeNumericId(release.runId);
      if (!projectCode || !runId) continue;
      if (normalizedProjects.size > 0 && !normalizedProjects.has(projectCode)) continue;

      const key = `${projectCode}:${runId}`;
      if (lookup.has(key)) continue;

      lookup.set(key, {
        slug: release.slug,
        title: normalizeString(release.title),
      });
    }

    return lookup;
  });
}

function normalizeDefectList(
  entities: unknown[],
  projectCode?: string,
  releaseRunsByKey: Map<string, ReleaseRunLookup> = new Map(),
): Defect[] {
  return entities
    .map((d) => {
      const rec = asRecord(d) ?? {};
      const idRaw = rec.id ?? rec.defect_id;
      const id = Number(idRaw);
      if (!Number.isFinite(id)) return null;

      const project =
        (typeof rec.project === "string" ? rec.project : null) ||
        (typeof rec.project_code === "string" ? rec.project_code : null) ||
        projectCode ||
        undefined;
      const runId = normalizeNumericId(rec.run_id ?? rec.run);
      const runLookup = project && runId ? releaseRunsByKey.get(`${project}:${runId}`) ?? null : null;
      const title =
        (typeof rec.title === "string" ? rec.title : null) ||
        (typeof rec.name === "string" ? rec.name : null) ||
        `Defect ${id}`;
      const createdAt =
        (typeof rec.created_at === "string" ? rec.created_at : null) ||
        (typeof rec.createdAt === "string" ? rec.createdAt : null) ||
        (typeof rec.created === "string" ? rec.created : null) ||
        undefined;
      const updatedAt =
        (typeof rec.updated_at === "string" ? rec.updated_at : null) ||
        (typeof rec.updatedAt === "string" ? rec.updatedAt : null) ||
        (typeof rec.updated === "string" ? rec.updated : null) ||
        undefined;
      const defectUrl =
        (typeof rec.url === "string" ? rec.url : null) ||
        (typeof rec.link === "string" ? rec.link : null) ||
        (typeof rec.web_url === "string" ? rec.web_url : null) ||
        undefined;

      return {
        id,
        title,
        name: title,
        status: typeof rec.status === "string" ? rec.status : undefined,
        severity:
          (typeof rec.severity === "string" ? rec.severity : null) ??
          (typeof rec.severity_name === "string" ? rec.severity_name : null) ??
          undefined,
        description: typeof rec.description === "string" ? rec.description : undefined,
        project,
        project_code: project,
        source: "QASE",
        origin: "qase",
        run_id: runId,
        runId,
        runSlug: runLookup?.slug ?? (project && runId ? `qase-${project.toLowerCase()}-${runId}` : null),
        runName: runLookup?.title ?? (runId ? `Run ${runId}` : null),
        url: defectUrl,
        externalUrl: defectUrl,
        created_at: createdAt,
        createdAt,
        updated_at: updatedAt,
        updatedAt,
        closedAt: resolveClosedAt(
          normalizeDefectStatus(rec.status),
          rec.closed_at ?? rec.closedAt,
          normalizeDefectStatus(rec.status) === "done" ? updatedAt ?? null : null,
        ),
      } satisfies Defect;
    })
    .filter(Boolean) as Defect[];
}

async function fetchProjectDefectsFromBase(
  baseUrl: string,
  projectCode: string,
  token: string,
  releaseRunsByKey: Map<string, ReleaseRunLookup> = new Map(),
): Promise<Defect[]> {
  if (!projectCode || !token) return [];

  const limit = 100;
  let offset = 0;
  const all: Defect[] = [];

  while (true) {
    const res = await fetch(`${baseUrl}/v1/defect/${encodeURIComponent(projectCode)}?limit=${limit}&offset=${offset}`, {
      headers: { Token: token, Accept: "application/json" },
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      break;
    }

    const entities = (asRecord(asRecord(json)?.result)?.entities as unknown[]) || [];
    if (!entities.length) {
      break;
    }

    all.push(...normalizeDefectList(entities, projectCode, releaseRunsByKey));

    if (entities.length < limit) {
      break;
    }

    offset += limit;
  }

  return all;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedCompanySlug = normalizeString(url.searchParams.get("companySlug")) || null;

  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ success: false, error: { message: "Nao autorizado" } }, { status: 401 });
  if (!auth.isGlobalAdmin && !isCompanyUser(auth)) {
    return NextResponse.json({ success: false, error: { message: "Sem permissao" } }, { status: 403 });
  }
  if (requestedCompanySlug && !auth.isGlobalAdmin) {
    const allowedSlugs = Array.isArray(auth.companySlugs) ? auth.companySlugs : [];
    if (!allowedSlugs.includes(requestedCompanySlug)) {
      return NextResponse.json({ success: false, error: { message: "Acesso proibido" } }, { status: 403 });
    }
  }

  const requestedProject = normalizeProjectCode(url.searchParams.get("project")) || null;
  const project = requestedProject === "ALL" ? null : requestedProject;

  const companySlug =
    auth.isGlobalAdmin && requestedCompanySlug
      ? requestedCompanySlug
      : requestedCompanySlug && Array.isArray(auth.companySlugs) && auth.companySlugs.includes(requestedCompanySlug)
        ? requestedCompanySlug
        : auth.companySlug ?? auth.companySlugs?.[0] ?? null;
  const qaseSettings = companySlug ? await getClientQaseSettings(companySlug) : null;
  const tokenToUse = qaseSettings?.token || QASE_TOKEN;
  const baseUrl = (qaseSettings?.baseUrl || QASE_BASE_URL).replace(/\/+$/, "");

  if (!tokenToUse) {
    return NextResponse.json({ success: true, data: [], warning: "QASE_API_TOKEN ausente" }, { status: 200 });
  }

  const configuredProjects = Array.from(
    new Set(
      [
        ...(Array.isArray(qaseSettings?.projectCodes) ? qaseSettings.projectCodes : []),
        qaseSettings?.projectCode,
      ]
        .map((value) => normalizeProjectCode(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const fallbackProjects = PROJECTS_FALLBACK
    .map((value) => normalizeProjectCode(value))
    .filter((value): value is string => Boolean(value));
  const projects = project ? [project] : configuredProjects.length ? configuredProjects : fallbackProjects;
  const releaseRunsByKey = await buildReleaseRunLookup(projects);
  const lists = await Promise.all(projects.map((p) => fetchProjectDefectsFromBase(baseUrl, p, tokenToUse, releaseRunsByKey)));
  const merged = lists.flat();

  return NextResponse.json({ success: true, data: merged }, { status: 200 });
}
