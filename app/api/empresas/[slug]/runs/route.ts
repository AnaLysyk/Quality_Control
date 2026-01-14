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

const PROJECT_MAP: Record<string, string> = {
  griaule: process.env.QASE_PROJECT_CODE || process.env.QASE_PROJECT || "",
};

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
  if (!access) return jsonError("Unauthorized", 401);

  const effectiveSlug = access.isGlobalAdmin ? requestedSlug : access.clientSlug;
  if (!effectiveSlug) return jsonError("Usuário sem empresa vinculada", 403);
  if (!access.isGlobalAdmin && requestedSlug !== effectiveSlug) return jsonError("Forbidden", 403);

  const clientSettings = await getClientQaseSettings(effectiveSlug);
  const projectCode = clientSettings?.projectCode ?? PROJECT_MAP[effectiveSlug];
  const token = clientSettings?.token ?? FALLBACK_TOKEN;

  const runs: RunPayload[] = [];

  if (projectCode && token) {
    const qaseRuns = await listQaseRuns(projectCode, token);
    runs.push(
      ...qaseRuns
        .filter((run) => !!run)
        .map(
          (run): RunPayload => ({
            slug: run.slug ?? `qase-${run.id}`,
            name: run.name ?? `Run ${run.id}`,
            runId: run.id,
            status: run.status ?? "ACTIVE",
            createdAt: run.createdAt,
            source: "QASE",
            origin: "automatico",
          }),
        ),
    );
  }

  const [persistedRuns, manualReleases] = await Promise.all([getAllReleases(), getAllManualReleases()]);

  const merged = new Map<string, RunPayload>();

  runs.forEach((r) => merged.set(r.slug, r));

  persistedRuns
    .filter((release) => {
      if (!projectCode) return false;
      return (release.qaseProject ?? "").toUpperCase() === projectCode.toUpperCase();
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

  return NextResponse.json({ runs: Array.from(merged.values()) }, { status: 200 });
}
