import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { CompanyAccessError, assertCompanyAccess } from "@/lib/rbac/validateCompanyAccess";
import { findLocalCompanyById, findLocalCompanyBySlug } from "@/lib/auth/localStore";
import { readManualReleaseCases, readManualReleases, type ManualCaseItem } from "@/lib/manualReleaseStore";
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";
import type { Release } from "@/types/release";

function normalizeIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const timestamp = Date.parse(trimmed);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function isCompanyActive(company: { active?: boolean; status?: unknown }): boolean {
  if (company.active === false) return false;
  if (typeof company.status !== "string") return true;
  const normalized = company.status.trim().toLowerCase();
  if (!normalized) return true;
  return normalized === "active" || normalized === "ativa" || normalized === "ativo";
}

type ManualBoardItem = {
  id: string;
  slug: string;
  name: string;
  kind: "run" | "defect";
  app: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  closedAt: string | null;
  metrics: {
    pass: number;
    fail: number;
    blocked: number;
    notRun: number;
    total: number;
    passRate: number;
  };
  runSlug: string | null;
  runName: string | null;
  casesCount?: number;
};

function asBoardItem(release: Release, cases: Record<string, ManualCaseItem[] | undefined>): ManualBoardItem {
  const stats = release.stats ?? { pass: 0, fail: 0, blocked: 0, notRun: 0 };
  const pass = Math.max(0, Number(stats.pass ?? 0));
  const fail = Math.max(0, Number(stats.fail ?? 0));
  const blocked = Math.max(0, Number(stats.blocked ?? 0));
  const notRun = Math.max(0, Number(stats.notRun ?? 0));
  const total = pass + fail + blocked + notRun;
  const passRate = total > 0 ? Math.round((pass / total) * 100) : 0;
  const slug = (release.slug ?? release.id ?? "").trim();
  const kind = resolveManualReleaseKind(release);
  const casesCount = kind === "run" && slug.length > 0 ? (cases[slug]?.length ?? 0) : undefined;

  return {
    id: (release.id ?? slug ?? "manual-item").toString(),
    slug,
    name: typeof release.name === "string" && release.name.length > 0 ? release.name : slug || "Manual release",
    kind,
    app: typeof release.app === "string" ? release.app : null,
    status: typeof release.status === "string" ? release.status : null,
    createdAt: normalizeIso(release.createdAt),
    updatedAt: normalizeIso(release.updatedAt) ?? normalizeIso(release.createdAt),
    closedAt: normalizeIso(release.closedAt),
    metrics: { pass, fail, blocked, notRun, total, passRate },
    runSlug: typeof release.runSlug === "string" ? release.runSlug : null,
    runName: typeof release.runName === "string" ? release.runName : null,
    casesCount,
  };
}

type StatusBucket = "open" | "done" | "draft" | "unknown";

function mapStatus(value: string | null): StatusBucket {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "unknown";
  if (["done", "closed", "finalized", "finalizado", "finalizada", "final"].includes(normalized)) return "done";
  if (["draft", "pending", "backlog", "proposed"].includes(normalized)) return "draft";
  return "open";
}

type CollectionSummary = {
  total: number;
  status: Record<StatusBucket, number>;
  attention: {
    failing: number;
    blocked: number;
  };
  metrics: {
    pass: number;
    fail: number;
    blocked: number;
    notRun: number;
    total: number;
    passRate: number;
  };
  latestActivityAt: string | null;
  casesTotal?: number;
};

function summarize(items: ManualBoardItem[], opts?: { includeCasesTotal?: boolean }): CollectionSummary {
  const status: Record<StatusBucket, number> = { open: 0, done: 0, draft: 0, unknown: 0 };
  const metrics = { pass: 0, fail: 0, blocked: 0, notRun: 0, total: 0, passRate: 0 };
  let latestActivity: number | null = null;
  let failing = 0;
  let blockedCount = 0;
  let casesTotal = 0;

  for (const item of items) {
    const bucket = mapStatus(item.status);
    status[bucket] += 1;

    metrics.pass += item.metrics.pass;
    metrics.fail += item.metrics.fail;
    metrics.blocked += item.metrics.blocked;
    metrics.notRun += item.metrics.notRun;

    if (item.metrics.fail > 0) failing += 1;
    if (item.metrics.blocked > 0) blockedCount += 1;

    const activitySource = item.updatedAt ?? item.createdAt;
    const activityValue = activitySource ? Date.parse(activitySource) : Number.NaN;
    if (!Number.isNaN(activityValue)) {
      if (latestActivity === null || activityValue > latestActivity) {
        latestActivity = activityValue;
      }
    }

    if (opts?.includeCasesTotal && typeof item.casesCount === "number") {
      casesTotal += item.casesCount;
    }
  }

  const totalMetrics = metrics.pass + metrics.fail + metrics.blocked + metrics.notRun;
  metrics.total = totalMetrics;
  metrics.passRate = totalMetrics > 0 ? Math.round((metrics.pass / totalMetrics) * 100) : 0;

  return {
    total: items.length,
    status,
    attention: { failing, blocked: blockedCount },
    metrics,
    latestActivityAt: typeof latestActivity === "number" ? new Date(latestActivity).toISOString() : null,
    ...(opts?.includeCasesTotal ? { casesTotal } : {}),
  };
}

type RouteParams = { params: { companyId?: string } };

function assertCompanyAccessWithFallback(
  authUser: unknown,
  company: { id: string; slug?: string | null },
): void {
  try {
    assertCompanyAccess(authUser as any, company.id);
    return;
  } catch (err) {
    if (err instanceof CompanyAccessError && err.code === "MISSING_COMPANY_ID") {
      throw err;
    }
    if (err instanceof CompanyAccessError && err.code === "FORBIDDEN_COMPANY_ACCESS" && company.slug) {
      assertCompanyAccess(authUser as any, company.slug);
      return;
    }
    throw err;
  }
}

export async function GET(req: Request, context: { params: Promise<{ companyId: string }> }) {
  const params = await context.params;
  const rawParam = params?.companyId;
  const companyRef = typeof rawParam === "string" ? decodeURIComponent(rawParam).trim() : "";
  if (!companyRef) {
    return NextResponse.json({ error: "companyId ausente" }, { status: 400 });
  }

  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const company =
    (await findLocalCompanyById(companyRef).catch(() => null)) ??
    (await findLocalCompanyBySlug(companyRef).catch(() => null));

  if (!company) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  if (!isCompanyActive(company)) {
    return NextResponse.json({ error: "Empresa inativa" }, { status: 403 });
  }

  try {
    assertCompanyAccessWithFallback(authUser, company);
  } catch (err) {
    if (err instanceof CompanyAccessError && err.code === "MISSING_COMPANY_ID") {
      return NextResponse.json({ error: "companyId ausente" }, { status: 400 });
    } else {
      return NextResponse.json({ error: "Sem acesso a empresa" }, { status: 403 });
    }
  }

  const [allReleases, caseStore] = await Promise.all([readManualReleases(), readManualReleaseCases()]);
  const acceptedSlugs = new Set(
    [company.id, company.slug]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .map((value) => value.toLowerCase()),
  );

  const scoped = allReleases.filter((release) => {
    const candidate = (release.clientSlug ?? "").trim().toLowerCase();
    return candidate ? acceptedSlugs.has(candidate) : false;
  });

  const sorted = scoped
    .map((entry) => ({ entry, timestamp: Date.parse(entry.updatedAt ?? entry.createdAt ?? "") }))
    .sort((a, b) => {
      if (!Number.isNaN(b.timestamp) && !Number.isNaN(a.timestamp)) return b.timestamp - a.timestamp;
      if (!Number.isNaN(b.timestamp)) return 1;
      if (!Number.isNaN(a.timestamp)) return -1;
      return 0;
    })
    .map(({ entry }) => entry);

  const runs: ManualBoardItem[] = [];
  const releases: ManualBoardItem[] = [];

  for (const entry of sorted) {
    const item = asBoardItem(entry, caseStore);
    if (item.kind === "run") {
      runs.push(item);
    } else {
      releases.push(item);
    }
  }

  const runsSummary = summarize(runs, { includeCasesTotal: true });
  const releasesSummary = summarize(releases);

  return NextResponse.json(
    {
      company: {
        id: company.id,
        slug: company.slug ?? null,
        name: company.name ?? company.company_name ?? company.id ?? companyRef,
      },
      runs: {
        items: runs,
        summary: runsSummary,
      },
      releases: {
        items: releases,
        summary: releasesSummary,
      },
    },
    { status: 200 },
  );
}
