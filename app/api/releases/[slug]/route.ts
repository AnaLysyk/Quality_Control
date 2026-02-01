import { NextResponse } from "next/server";

import { getAllReleases, upsertRelease, type ReleaseEntry } from "@/release/data";
import { slugifyRelease } from "@/lib/slugifyRelease";
import { canEditRun } from "@/lib/rbac/runs";
import { getClientQaseSettings } from "@/lib/qaseConfig";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";

export const runtime = "nodejs";

function normalizeRole(value: unknown): "admin" | "company" | "user" {
  const raw = typeof value === "string" ? value.toLowerCase() : "";
  if (raw === "admin" || raw === "global_admin") return "admin";
  if (["company", "client", "client_admin", "client_owner", "client_manager"].includes(raw)) return "company";
  return "user";
}

function resolveReleaseProjectCode(release: ReleaseEntry): string {
  const raw = (release.qaseProject ?? release.project ?? release.app ?? "").toString();
  return raw.trim().toUpperCase();
}

function isAdmin(user: AuthUser) {
  if (user.isGlobalAdmin) return true;
  return normalizeRole(user.role) === "admin";
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = await getAllReleases();
  const target = all.find((r) => r.slug === slugifyRelease(slug));
  if (!target) {
    return NextResponse.json({ error: "Release nao encontrada." }, { status: 404 });
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

  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const all = await getAllReleases();
  const existing = all.find((r) => r.slug === slug);
  if (!existing) {
    return NextResponse.json({ error: "Release nao encontrada." }, { status: 404 });
  }

  const role = normalizeRole(user.role);
  if (!canEditRun(role)) {
    return NextResponse.json({ error: "Acesso proibido" }, { status: 403 });
  }

  if (!isAdmin(user)) {
    const slugToCheck = user.companySlug;
    if (!slugToCheck) {
      return NextResponse.json({ error: "Usuario sem empresa vinculada" }, { status: 403 });
    }

    const clientSettings = await getClientQaseSettings(slugToCheck);
    const projectCodes = new Set<string>();
    (clientSettings?.projectCodes ?? []).forEach((code) => {
      const normalized = typeof code === "string" ? code.trim().toUpperCase() : "";
      if (normalized) projectCodes.add(normalized);
    });
    if (!projectCodes.size && clientSettings?.projectCode) {
      const normalized = clientSettings.projectCode.trim().toUpperCase();
      if (normalized) projectCodes.add(normalized);
    }

    const releaseProject = resolveReleaseProjectCode(existing);
    if (!projectCodes.size || !releaseProject || !projectCodes.has(releaseProject)) {
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
