import { NextResponse } from "next/server";
import { deleteReleaseFromStore, getAllReleases, upsertRelease } from "@/release/data";
import { slugifyRelease } from "@/lib/slugifyRelease";
import { authenticateRequest } from "@/lib/jwtAuth";
import { canCreateRun, canDeleteRun, getRunMockRole, resolveRunRole } from "@/lib/rbac/runs";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { notifyIntegrationRunCreated } from "@/lib/notificationService";
import { syncReleaseToBrain } from "@/lib/brain-sync";

// Garantir ambiente Node para fs
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const companySlugParam = url.searchParams.get("companySlug") || undefined;

  const releases = await getAllReleases();

  // Filtra por empresa se o parâmetro foi fornecido
  const filteredReleases = companySlugParam
    ? releases.filter((r) => r.clientId === companySlugParam || r.clientName === companySlugParam)
    : releases;

  // normaliza payload com id/title/status consistente para o Kanban/listas
  const normalized = filteredReleases.map((r) => ({
    id: r.slug,
    slug: r.slug,
    title: r.title,
    name: r.title,
    summary: r.summary,
    status: r.status ?? "ACTIVE",
    app: r.app ?? r.project,
    project: r.project,
    runId: r.runId,
    qaseProject: r.qaseProject,
    radis: r.radis,
    source: r.source ?? "API",
    createdAt: r.createdAt,
    clientId: r.clientId ?? null,
    clientName: r.clientName ?? null,
    assigneeNames: r.assigneeNames ?? null,
    manualSummary: r.manualSummary ?? null,
    metrics: r.metrics ?? null,
  }));
  return NextResponse.json({ releases: normalized });
}

export async function POST(request: Request) {
  try {
    const actor = await authenticateRequest(request).catch(() => null);

    const mockRole = await getRunMockRole();
    const effectiveActor = actor ?? (mockRole ? { id: `mock-${mockRole}`, email: `${mockRole}@example.com`, isGlobalAdmin: mockRole === "leader_tc" } : null);
    if (!effectiveActor) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const role = mockRole ?? (await resolveRunRole(effectiveActor));
    if (!canCreateRun(role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const name = (body.name ?? body.title ?? "").toString();
    const runIdRaw = body.runId ?? body.run_id;
    const appRaw = (body.app ?? body.project ?? "smart").toString();
    const qaseProjectRaw = (body.qaseProject ?? body.qase_project_code ?? body.projectCode ?? appRaw).toString();
    const summary = (body.summary ?? body.description ?? "Run cadastrada pelo painel.").toString();
    const radis = (body.radis ?? body.RADIS ?? "").toString() || undefined;
    const clientSlug = (body.clientSlug ?? body.client_slug ?? "").toString() || undefined;
    const clientId = (body.clientId ?? body.client_id ?? clientSlug ?? "").toString() || undefined;
    const clientName = (body.clientName ?? body.client_name ?? "").toString() || undefined;

    if (!name || runIdRaw === undefined || runIdRaw === null) {
      return NextResponse.json({ error: "Informe nome e runId." }, { status: 400 });
    }

    const runId = Number(runIdRaw);
    if (Number.isNaN(runId)) {
      return NextResponse.json({ error: "runId deve ser um número." }, { status: 400 });
    }

    const slug = slugifyRelease(body.slug || name);
    const app = appRaw.toLowerCase();

    const release = await upsertRelease({
      slug,
      title: name,
      summary,
      runId,
      app,
      project: app,
      qaseProject: qaseProjectRaw.trim().toUpperCase() || app.toUpperCase(),
      radis,
      clientId: clientId ?? null,
      clientName: clientName ?? null,
      source: "API",
    });

    await addAuditLogSafe({
      actorUserId: effectiveActor?.id ?? null,
      actorEmail: effectiveActor?.email ?? null,
      action: "run.created",
      entityType: "run",
      entityId: release.slug,
      entityLabel: release.title,
      metadata: { runId: release.runId, app: release.app ?? release.project },
    });

    notifyIntegrationRunCreated({
      slug: release.slug,
      title: release.title,
      clientId: release.clientId ?? null,
      clientName: release.clientName ?? null,
      qaseProject: release.qaseProject ?? null,
    }).catch(() => {});

    const payload = {
      id: release.slug,
      slug: release.slug,
      title: release.title,
      name: release.title,
      summary: release.summary,
      status: release.status ?? "ACTIVE",
      app: release.app ?? release.project,
      project: release.project,
      runId: release.runId,
      qaseProject: release.qaseProject,
      radis: release.radis,
      source: release.source ?? "API",
      createdAt: release.createdAt,
      clientId: release.clientId ?? null,
      clientName: release.clientName ?? null,
      assigneeNames: release.assigneeNames ?? null,
      manualSummary: release.manualSummary ?? null,
      metrics: null,
    };

    syncReleaseToBrain({
      id: release.slug,
      title: release.title,
      slug: release.slug,
      summary: release.summary ?? null,
      status: release.status ?? "ACTIVE",
      companyId: release.clientId ?? null,
    }).catch(() => {});

    return NextResponse.json({ release: payload });
  } catch (error) {
    console.error("POST /api/releases error:", error);
    return NextResponse.json({ error: "Erro ao salvar run." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await authenticateRequest(request).catch(() => null);
    const mockRole = await getRunMockRole();
    const effectiveActor = actor ?? (mockRole ? { id: `mock-${mockRole}`, email: `${mockRole}@example.com`, isGlobalAdmin: mockRole === "leader_tc" } : null);
    if (!effectiveActor) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const role = mockRole ?? (await resolveRunRole(effectiveActor));
    if (!canDeleteRun(role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const slug = body.slug ? slugifyRelease(body.slug) : "";
    if (!slug) {
      return NextResponse.json({ error: "Slug e obrigatório." }, { status: 400 });
    }
    const removed = await deleteReleaseFromStore(slug);

    if (removed) {
      await addAuditLogSafe({
        actorUserId: effectiveActor?.id ?? null,
        actorEmail: effectiveActor?.email ?? null,
        action: "run.deleted",
        entityType: "run",
        entityId: slug,
        entityLabel: slug,
      });
    }

    return NextResponse.json({ ok: removed });
  } catch (error) {
    console.error("DELETE /api/releases error:", error);
    return NextResponse.json({ error: "Erro ao remover run." }, { status: 500 });
  }
}
