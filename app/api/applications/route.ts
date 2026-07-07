import { NextResponse } from "next/server";
import { listApplications, createApplication } from "../../../lib/applicationsStore";
import { getCompanyIntegratedDefects } from "../../../lib/companyDefects";
import { syncApplicationToBrain } from "@/lib/brain-sync";
import { resolveOperationalContext } from "@/lib/context/operationalContext";

const APPLICATIONS_CACHE_TTL_MS = 30_000;

type ApplicationsPayload = {
  items: Awaited<ReturnType<typeof listApplications>>;
  blockedItems?: unknown[];
};

type ApplicationsCacheEntry = {
  expiresAt: number;
  payload: ApplicationsPayload;
};

type ApplicationsRouteGlobalState = typeof globalThis & {
  __qcApplicationsApiCache?: Map<string, ApplicationsCacheEntry>;
};

function getApplicationsCache() {
  const globalState = globalThis as ApplicationsRouteGlobalState;
  if (!globalState.__qcApplicationsApiCache) {
    globalState.__qcApplicationsApiCache = new Map();
  }
  return globalState.__qcApplicationsApiCache;
}

function readApplicationsCache(cacheKey: string) {
  const cached = getApplicationsCache().get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }
  return null;
}

function writeApplicationsCache(cacheKey: string, payload: ApplicationsPayload) {
  getApplicationsCache().set(cacheKey, {
    expiresAt: Date.now() + APPLICATIONS_CACHE_TTL_MS,
    payload,
  });
}

function clearApplicationsCache() {
  getApplicationsCache().clear();
}

function normalizeProjectCode(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

function isLightRequest(url: URL) {
  const value = (url.searchParams.get("light") ?? url.searchParams.get("summary") ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function normalizeCompanySlug(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedCompanySlug = normalizeCompanySlug(url.searchParams.get("companySlug"));
  const contextResult = await resolveOperationalContext(request, {
    moduleId: "applications",
    action: "view",
    companySlug: requestedCompanySlug || null,
  });
  if (!contextResult.ok) return contextResult.response;

  const companySlug = requestedCompanySlug || (contextResult.context.scope === "global" ? undefined : contextResult.context.companySlug ?? undefined);
  const light = isLightRequest(url);
  const cacheKey = companySlug ? `company:${companySlug}:light:${light ? "1" : "0"}` : `all:light:${light ? "1" : "0"}`;

  const cached = readApplicationsCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "x-qc-cache": "hit" },
    });
  }

  const items = await listApplications(companySlug ? { companySlug } : undefined);

  if (!companySlug || light) {
    const payload = { items };
    writeApplicationsCache(cacheKey, payload);

    return NextResponse.json(payload, {
      headers: { "x-qc-cache": "miss", "x-qc-mode": light ? "light" : "full" },
    });
  }

  const integrated = await getCompanyIntegratedDefects(companySlug);
  const blockedProjects = integrated.projects.filter((project) => !project.accessible);
  const blockedProjectMap = new Map(blockedProjects.map((project) => [project.projectCode, project]));

  const visibleItems = items.filter((item) => {
    const projectCode = normalizeProjectCode(item.qaseProjectCode);
    return !projectCode || !blockedProjectMap.has(projectCode);
  });

  const blockedItems = [
    ...items
      .filter((item) => {
        const projectCode = normalizeProjectCode(item.qaseProjectCode);
        return Boolean(projectCode && blockedProjectMap.has(projectCode));
      })
      .map((item) => {
        const projectCode = normalizeProjectCode(item.qaseProjectCode);
        const blocked = projectCode ? blockedProjectMap.get(projectCode) ?? null : null;

        return {
          ...item,
          accessReason: blocked?.reason ?? "error",
          accessMessage: blocked?.message ?? "Projeto Qase indisponivel",
          unavailable: true,
        };
      }),
    ...blockedProjects
      .filter((project) => {
        return !items.some((item) => normalizeProjectCode(item.qaseProjectCode) === project.projectCode);
      })
      .map((project) => ({
        id: `blocked_${project.projectCode}`,
        companySlug,
        name: project.projectCode,
        slug: project.projectCode.toLowerCase(),
        description: null,
        imageUrl: null,
        qaseProjectCode: project.projectCode,
        source: "qase",
        active: false,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        accessReason: project.reason,
        accessMessage: project.message ?? "Projeto Qase indisponivel",
        unavailable: true,
      })),
  ];

  const payload = { items: visibleItems, blockedItems };
  writeApplicationsCache(cacheKey, payload);

  return NextResponse.json(payload, {
    headers: { "x-qc-cache": "miss", "x-qc-mode": "full" },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const companySlug = normalizeCompanySlug(body.companySlug ?? body.companyId ?? null);
    if (!companySlug) {
      return NextResponse.json({ error: "companySlug obrigatório" }, { status: 400 });
    }

    const contextResult = await resolveOperationalContext(request, {
      moduleId: "applications",
      action: "create",
      companySlug,
      requireCompany: true,
    });
    if (!contextResult.ok) return contextResult.response;

    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const created = await createApplication({
      name: String(body.name),
      slug: body.slug ? String(body.slug) : undefined,
      description: body.description ?? null,
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
      qaseProjectCode: typeof body.qaseProjectCode === "string" ? body.qaseProjectCode : null,
      source: typeof body.source === "string" ? body.source : null,
      companySlug,
      companyId: companySlug,
      active: body.active ?? true,
    });

    clearApplicationsCache();

    syncApplicationToBrain({
      id: created.id,
      name: created.name,
      slug: created.slug,
      description: created.description,
      companyId: created.companyId ?? companySlug,
      active: created.active,
      qaseProjectCode: created.qaseProjectCode,
      source: created.source,
    }).catch(() => {});

    return NextResponse.json({ item: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
}
