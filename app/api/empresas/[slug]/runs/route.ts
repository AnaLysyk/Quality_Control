import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/lib/supabaseServer";

import { listQaseRuns } from "@/lib/qaseRuns";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { getAllReleases } from "@/release/data";
import { getAllManualReleases } from "@/release/manualData";

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

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

type Access = {
  userId: string;
  isGlobalAdmin: boolean;
  clientSlug: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

async function extractToken(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice("bearer ".length).trim();
    if (token) return token;
  }
  const store = await cookies();
  return store.get("sb-access-token")?.value || store.get("auth_token")?.value || null;
}

async function requireAccess(req: Request): Promise<Access | null> {
  if (SUPABASE_MOCK) {
    return { userId: "mock-uid", isGlobalAdmin: true, clientSlug: "mock-client" };
  }

  const token = await extractToken(req);
  if (!token) return null;

  const supabase = getSupabaseServer();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const userId = data.user.id;

  const { data: userRow } = await supabase
    .from("users")
    .select("client_id,is_global_admin,role")
    .eq("auth_user_id", userId)
    .eq("active", true)
    .maybeSingle();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("is_global_admin,role")
    .eq("id", userId)
    .maybeSingle();

  const isGlobalAdmin =
    (userRow as { is_global_admin?: unknown } | null)?.is_global_admin === true ||
    (userRow as { role?: unknown } | null)?.role === "global_admin" ||
    (userRow as { role?: unknown } | null)?.role === "admin" ||
    profileRow?.is_global_admin === true ||
    profileRow?.role === "global_admin";

  let clientSlug: string | null = null;
  const clientId = (userRow as { client_id?: unknown } | null)?.client_id;
  if (typeof clientId === "string" && clientId.trim()) {
    const { data: clientRow } = await supabase.from("cliente").select("slug").eq("id", clientId).maybeSingle();
    const slug = (clientRow as { slug?: unknown } | null)?.slug;
    if (typeof slug === "string" && slug.trim()) clientSlug = slug.trim();
  }

  return { userId, isGlobalAdmin, clientSlug };
}

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug: requestedSlug } = await context.params;

  const access = await requireAccess(req);
  if (!access) return jsonError("Não autorizado", 401);

  const effectiveSlug = access.isGlobalAdmin ? requestedSlug : access.clientSlug;
  if (!effectiveSlug) return jsonError("Usuário sem empresa vinculada", 403);
  if (!access.isGlobalAdmin && requestedSlug !== effectiveSlug) return jsonError("Acesso proibido", 403);

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
