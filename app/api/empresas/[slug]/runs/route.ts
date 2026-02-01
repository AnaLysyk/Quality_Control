import { NextResponse } from "next/server";

import { listQaseRuns } from "@/lib/qaseRuns";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { getAllReleases } from "@/release/data";
import { getAllManualReleases } from "@/release/manualData";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";

type RunPayload = {
  slug: string;
  name: string;
  runId?: number;
  status?: string;
  createdAt?: string;
  source: "QASE" | "MANUAL";
  origin: "automatico" | "manual";
};

const FALLBACK_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function normalizeRole(role?: string | null) {
  return (role ?? "").trim().toLowerCase();
}

function isAdmin(user: AuthUser) {
  if (user.isGlobalAdmin) return true;
  const role = normalizeRole(user.role);
  return role === "admin" || role === "global_admin";
}

function resolveAllowedSlugs(user: AuthUser): string[] {
  if (Array.isArray(user.companySlugs) && user.companySlugs.length) return user.companySlugs;
  if (user.companySlug) return [user.companySlug];
  return [];
}

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug: requestedSlug } = await context.params;

  const user = await authenticateRequest(req);
  if (!user) return jsonError("Nao autorizado", 401);

  const admin = isAdmin(user);
  const allowed = resolveAllowedSlugs(user);
  const effectiveSlug = admin ? requestedSlug : user.companySlug ?? allowed[0] ?? null;
  if (!effectiveSlug) return jsonError("Usuario sem empresa vinculada", 403);
  if (!admin && requestedSlug && !allowed.includes(requestedSlug)) return jsonError("Acesso proibido", 403);

  const clientSettings = await getClientQaseSettings(effectiveSlug);
  const token = clientSettings?.token ?? FALLBACK_TOKEN;
  const projectCodesSet = new Set<string>();
  const settingsCodes = clientSettings?.projectCodes ?? [];
  settingsCodes.forEach((code) => {
    const normalized = typeof code === "string" ? code.trim().toUpperCase() : "";
    if (normalized) projectCodesSet.add(normalized);
  });
  if (!projectCodesSet.size && clientSettings?.projectCode) {
    const normalized = clientSettings.projectCode.trim().toUpperCase();
    if (normalized) projectCodesSet.add(normalized);
  }
  const projectCodes = Array.from(projectCodesSet);

  const runs: RunPayload[] = [];
  const warnings: string[] = [];

  if (token && projectCodes.length) {
    const results = await Promise.all(
      projectCodes.map(async (projectCode) => ({ projectCode, result: await listQaseRuns(projectCode, token) })),
    );

    results.forEach(({ projectCode, result }) => {
      if (result.ok) {
        runs.push(
          ...(result.data ?? []).map(
            (run): RunPayload => ({
              slug: `qase-${projectCode}-${run.id}`,
              name: run.name ?? `Run ${run.id}`,
              runId: run.id,
              status: run.status ?? "ACTIVE",
              createdAt: run.createdAt,
              source: "QASE",
              origin: "automatico",
            }),
          ),
        );
      } else if (result?.warning) {
        warnings.push(`[${projectCode}] ${result.warning}`);
      }
    });
  }

  const [persistedRuns, manualReleases] = await Promise.all([getAllReleases(), getAllManualReleases()]);

  const merged = new Map<string, RunPayload>();
  runs.forEach((r) => merged.set(r.slug, r));

  persistedRuns
    .filter((release) => {
      if (!projectCodes.length) return false;
      const project = (release.qaseProject ?? "").toUpperCase();
      return projectCodes.includes(project);
    })
    .forEach((release) => {
      merged.set(release.slug, {
        slug: release.slug,
        name: release.title,
        runId: release.runId,
        status: release.status ?? "ACTIVE",
        createdAt: release.createdAt,
        source: "MANUAL",
        origin: "manual",
      });
    });

  manualReleases
    .filter((release) => (release.clientSlug ?? null) === effectiveSlug)
    .forEach((release) => {
      merged.set(release.slug, {
        slug: release.slug,
        name: release.name ?? release.slug,
        runId: release.runId,
        status: (release.status as unknown as string) ?? "ACTIVE",
        createdAt: release.createdAt,
        source: "MANUAL",
        origin: "manual",
      });
    });

  const sorted = Array.from(merged.values()).sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : NaN;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : NaN;
    const aSort = Number.isFinite(aTime) ? aTime : 0;
    const bSort = Number.isFinite(bTime) ? bTime : 0;
    if (aSort !== bSort) return bSort - aSort;

    const aId = typeof a.runId === "number" ? a.runId : -1;
    const bId = typeof b.runId === "number" ? b.runId : -1;
    if (aId !== bId) return bId - aId;

    return a.slug.localeCompare(b.slug);
  });

  const responseBody: Record<string, unknown> = { runs: sorted };
  if (warnings.length) responseBody.warnings = warnings;

  return NextResponse.json(responseBody, { status: 200 });
}
