import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getAllReleases, upsertRelease, type ReleaseEntry } from "@/release/data";
import { slugifyRelease } from "@/lib/slugifyRelease";
import { canEditRun } from "@/lib/rbac/runs";
import { SUPABASE_MOCK } from "@/lib/supabaseMock";

export const runtime = "nodejs";


function normalizeAccessRole(value: unknown): "admin" | "company" | "user" {
  const raw = typeof value === "string" ? value.toLowerCase() : "";
  if (raw == "admin" || raw == "global_admin") return "admin";
  if (["company", "client", "client_admin", "client_owner", "client_manager"].includes(raw)) return "company";
  return "user";
}

type Access = {
  authUserId: string;
  isGlobalAdmin: boolean;
  clientId: string | null;
  qaseProjectCode: string | null;
  role: "admin" | "company" | "user";
};

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
    const store = await cookies();
    const mockRaw = store.get("mock_role")?.value?.toLowerCase();
    const role = mockRaw === "company" ? "company" : mockRaw === "user" ? "user" : "admin";
    return { authUserId: "mock-uid", isGlobalAdmin: role === "admin", clientId: "mock-client", qaseProjectCode: "SFQ", role };
  }

  const token = await extractToken(req);
  if (!token) return null;

  const supabase = getSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) return null;

  const authUserId = authData.user.id;

  const metadata = authData.user.app_metadata;
  const metadataRole =
    metadata && typeof metadata === "object" && "role" in metadata ? (metadata as Record<string, unknown>).role : null;

  const { data: userRow } = await supabase
    .from("users")
    .select("client_id,is_global_admin,role")
    .eq("auth_user_id", authUserId)
    .eq("active", true)
    .maybeSingle();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("is_global_admin,role")
    .eq("id", authUserId)
    .maybeSingle();

  const roleValue = (userRow as { role?: unknown } | null)?.role;
  const isGlobalAdmin =
    (userRow as { is_global_admin?: unknown } | null)?.is_global_admin === true ||
    roleValue === "global_admin" ||
    roleValue === "admin" ||
    profileRow?.is_global_admin === true ||
    profileRow?.role === "global_admin";

  const clientIdRaw = (userRow as { client_id?: unknown } | null)?.client_id;
  const clientId = typeof clientIdRaw === "string" && clientIdRaw.trim() ? clientIdRaw.trim() : null;

  let qaseProjectCode: string | null = null;
  if (clientId) {
    const { data: clientRow } = await supabase
      .from("cliente")
      .select("qase_project_code")
      .eq("id", clientId)
      .maybeSingle();
    const code = (clientRow as { qase_project_code?: unknown } | null)?.qase_project_code;
    if (typeof code === "string" && code.trim()) qaseProjectCode = code.trim().toUpperCase();
  }

  const roleRaw = (userRow as { role?: unknown } | null)?.role ?? profileRow?.role ?? metadataRole ?? null;
  const role = isGlobalAdmin ? "admin" : normalizeAccessRole(roleRaw);

  return { authUserId, isGlobalAdmin, clientId, qaseProjectCode, role };
}

function resolveReleaseProjectCode(release: ReleaseEntry): string {
  const raw = (release.qaseProject ?? release.project ?? release.app ?? "").toString();
  return raw.trim().toUpperCase();
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = await getAllReleases();
  const target = all.find((r) => r.slug === slugifyRelease(slug));
  if (!target) {
    return NextResponse.json({ error: "Release não encontrada." }, { status: 404 });
  }
  return NextResponse.json({
    release: {
      id: target.slug,
      slug: target.slug,
      title: target.title,
      name: target.title,
      summary: target.summary,
      status: target.status ?? "ACTIVE",
      app: target.app ?? target.project,
      project: target.project,
      runId: target.runId,
      qaseProject: target.qaseProject,
      radis: target.radis,
      source: target.source ?? "API",
      createdAt: target.createdAt,
      clientId: target.clientId ?? null,
      clientName: target.clientName ?? null,
      assigneeNames: target.assigneeNames ?? null,
      manualSummary: target.manualSummary ?? null,
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = slugifyRelease(rawSlug);
  const body = await request.json().catch(() => ({}));

  const access = await requireAccess(request);
  if (!access) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const all = await getAllReleases();
  const existing = all.find((r) => r.slug === slug);
  if (!existing) {
    return NextResponse.json({ error: "Release não encontrada." }, { status: 404 });
  }

  if (!canEditRun(access.role)) {
    return NextResponse.json({ error: "Acesso proibido" }, { status: 403 });
  }

  // Company users can edit runs, but only within their own Qase project.
  if (!access.isGlobalAdmin) {
    if (!access.clientId) {
      return NextResponse.json({ error: "Usuário sem empresa vinculada" }, { status: 403 });
    }

    const releaseProject = resolveReleaseProjectCode(existing);
    if (!access.qaseProjectCode || !releaseProject || access.qaseProjectCode !== releaseProject) {
      return NextResponse.json({ error: "Acesso proibido" }, { status: 403 });
    }
  }

  const status = (body.status ?? existing.status ?? "ACTIVE") as ReleaseEntry["status"];
  const merged = {
    ...existing,
    title: (body.title ?? body.name ?? existing.title)?.toString(),
    summary: (body.summary ?? body.description ?? existing.summary)?.toString(),
    app: (body.app ?? body.project ?? existing.app ?? existing.project)?.toString(),
    project: (body.project ?? body.app ?? existing.project ?? existing.app)?.toString(),
    runId:
      body.runId !== undefined || body.run_id !== undefined
        ? Number(body.runId ?? body.run_id)
        : existing.runId,
    status,
    qaseProject: (body.qaseProject ?? body.project ?? existing.qaseProject)?.toString(),
    radis: (body.radis ?? existing.radis)?.toString(),
    source: existing.source ?? "API",
  };

  const saved = await upsertRelease({ ...merged, slug });

  const payload = {
    id: saved.slug,
    slug: saved.slug,
    title: saved.title,
    name: saved.title,
    summary: saved.summary,
    status: saved.status ?? "ACTIVE",
    app: saved.app ?? saved.project,
    project: saved.project,
    runId: saved.runId,
    qaseProject: saved.qaseProject,
    radis: saved.radis,
    source: saved.source ?? "API",
    createdAt: saved.createdAt,
    clientId: saved.clientId ?? null,
    clientName: saved.clientName ?? null,
    assigneeNames: saved.assigneeNames ?? null,
    manualSummary: saved.manualSummary ?? null,
  };

  return NextResponse.json({ release: payload });
}
