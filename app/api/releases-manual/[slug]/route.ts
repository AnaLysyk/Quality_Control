import { NextResponse } from "next/server";
import { slugifyRelease } from "@/lib/slugifyRelease";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";
import { canDeleteManualDefect, canEditManualDefect, getMockRole, resolveDefectRole } from "@/lib/rbac/defects";
import type { Release, Stats } from "@/types/release";
import { normalizeDefectStatus, resolveClosedAt } from "@/lib/defectNormalization";
import { evaluateQualityGate } from "@/lib/quality";
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";
import { readManualReleases, writeManualReleases } from "@/lib/manualReleaseStore";

function resolveAllowedSlugs(user: AuthUser): string[] {
  if (Array.isArray(user.companySlugs) && user.companySlugs.length) return user.companySlugs;
  if (user.companySlug) return [user.companySlug];
  return [];
}

function isFinalizeRequest(status?: string | null) {
  const upper = (status ?? "").trim().toUpperCase();
  return upper === "FINALIZADA" || upper === "FINALIZED" || upper === "FINALIZADO";
}

function normalizeStats(stats?: Partial<Stats> | null): Stats {
  return {
    pass: Math.max(0, Number(stats?.pass ?? 0)),
    fail: Math.max(0, Number(stats?.fail ?? 0)),
    blocked: Math.max(0, Number(stats?.blocked ?? 0)),
    notRun: Math.max(0, Number(stats?.notRun ?? 0)),
  };
}

export async function GET(_req: Request, context: { params: Promise<{ slug: string }> }) {
  const authUser = await authenticateRequest(_req);
  const mockRole = await getMockRole();
  const effectiveAuthUser =
    authUser ?? (mockRole ? { id: "mock-user", isGlobalAdmin: mockRole === "admin" } : null);
  if (!effectiveAuthUser) {
    return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
  }

  const { slug } = await context.params;
  const targetSlug = slugifyRelease(slug);
  const releases = await readManualReleases();
  const release = releases.find((r) => r.slug === targetSlug) ?? null;
  if (!release) return NextResponse.json({ message: "Nao encontrado" }, { status: 404 });

  if (!effectiveAuthUser.isGlobalAdmin) {
    const allowed = resolveAllowedSlugs(effectiveAuthUser as AuthUser);
    if (release.clientSlug && !allowed.includes(release.clientSlug)) {
      return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
    }
  }

  return NextResponse.json({ ...release, kind: resolveManualReleaseKind(release) });
}

export async function PATCH(req: Request, context: { params: Promise<{ slug: string }> }) {
  const authUser = await authenticateRequest(req);
  const mockRole = await getMockRole();
  const effectiveAuthUser =
    authUser ?? (mockRole ? { id: "mock-user", isGlobalAdmin: mockRole === "admin" } : null);
  if (!effectiveAuthUser) {
    return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
  }

  const { slug } = await context.params;
  const targetSlug = slugifyRelease(slug);
  const releases = await readManualReleases();
  const index = releases.findIndex((r) => r.slug === targetSlug);
  if (index < 0) return NextResponse.json({ message: "Nao encontrado" }, { status: 404 });

  const current = releases[index];
  if (!effectiveAuthUser.isGlobalAdmin) {
    const allowed = resolveAllowedSlugs(effectiveAuthUser as AuthUser);
    if (current.clientSlug && !allowed.includes(current.clientSlug)) {
      return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
    }
  }

  const role = await resolveDefectRole(effectiveAuthUser as AuthUser, current.clientSlug ?? null);
  if (!canEditManualDefect(role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "JSON invalido" }, { status: 400 });

  const nextKind = body.kind === "defect" ? "defect" : body.kind === "run" ? "run" : resolveManualReleaseKind(current);
  const nextStatusRaw = typeof body.status === "string" ? body.status : null;
  const nextStatus =
    nextKind === "defect" && nextStatusRaw ? normalizeDefectStatus(nextStatusRaw) : nextStatusRaw ?? current.status;

  if (isFinalizeRequest(nextStatusRaw)) {
    const gate = evaluateQualityGate(current.stats);
    if (gate.status === "failed") {
      return NextResponse.json({ message: "Quality gate bloqueado" }, { status: 403 });
    }
  }

  const statsPatch = body.stats && typeof body.stats === "object" ? normalizeStats(body.stats as Partial<Stats>) : current.stats;
  const now = new Date().toISOString();
  const closedAt =
    nextKind === "defect"
      ? resolveClosedAt(normalizeDefectStatus(nextStatus), current.closedAt ?? null, normalizeDefectStatus(nextStatus) === "done" ? now : null)
      : current.closedAt ?? null;

  const updated: Release = {
    ...current,
    name: typeof body.name === "string" ? body.name : typeof body.title === "string" ? body.title : current.name,
    status: nextStatus ?? current.status,
    runSlug: typeof body.runSlug === "string" ? body.runSlug : current.runSlug,
    runName: typeof body.runName === "string" ? body.runName : current.runName,
    stats: statsPatch,
    kind: nextKind,
    closedAt,
    updatedAt: now,
  };

  releases[index] = updated;
  await writeManualReleases(releases);
  return NextResponse.json({ ...updated, kind: resolveManualReleaseKind(updated) });
}

export async function DELETE(req: Request, context: { params: Promise<{ slug: string }> }) {
  const authUser = await authenticateRequest(req);
  const mockRole = await getMockRole();
  const effectiveAuthUser =
    authUser ?? (mockRole ? { id: "mock-user", isGlobalAdmin: mockRole === "admin" } : null);
  if (!effectiveAuthUser) {
    return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
  }

  const role = await resolveDefectRole(effectiveAuthUser as AuthUser, null);
  if (!canDeleteManualDefect(role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { slug } = await context.params;
  const targetSlug = slugifyRelease(slug);
  const releases = await readManualReleases();
  const target = releases.find((r) => r.slug === targetSlug) ?? null;
  if (!target) return NextResponse.json({ message: "Nao encontrado" }, { status: 404 });

  const filtered = releases.filter((r) => r.slug !== targetSlug);
  await writeManualReleases(filtered);
  return NextResponse.json({ ok: true });
}
