import { NextResponse } from "next/server";
import { slugifyRelease } from "@/lib/slugifyRelease";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";
import { canDeleteManualDefect, canEditManualDefect, getMockRole, resolveDefectRole } from "@/lib/rbac/defects";
import type { Release, Stats, ReleaseStatus } from "@/types/release";
import { normalizeDefectStatus, resolveClosedAt } from "@/lib/defectNormalization";
import { evaluateQualityGate } from "@/lib/quality";
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";
import { listManualReleaseResponsibleOptions, resolveLocalUserDisplayName } from "@/lib/manualReleaseResponsible";
import { readManualReleases, writeManualReleases } from "@/lib/manualReleaseStore";
import { notifyManualRunFailure } from "@/lib/notificationService";
import { appendDefectHistory } from "@/lib/manualDefectHistoryStore";
import { getLocalUserById } from "@/lib/auth/localStore";

async function resolveActor(authUser: AuthUser | null) {
  if (!authUser) return { actorId: null, actorName: null };
  const local = await getLocalUserById(authUser.id);
  return {
    actorId: authUser.id,
    actorName: resolveLocalUserDisplayName(local, authUser.email),
  };
}

async function buildResponsiblePayload(release: Release) {
  const availableResponsibles = await listManualReleaseResponsibleOptions(release.clientSlug ?? null, [
    release.createdByUserId,
    release.assignedToUserId,
  ]);
  return {
    responsibleLabel: release.assignedToName ?? release.createdByName ?? null,
    availableResponsibles,
  };
}

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
  const effectiveAuthUser: AuthUser | null =
    authUser ??
    (mockRole ? { id: "mock-user", email: "mock@local", isGlobalAdmin: mockRole === "admin" } : null);
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

  return NextResponse.json({
    ...release,
    kind: resolveManualReleaseKind(release),
    ...(await buildResponsiblePayload(release)),
  });
}

export async function PATCH(req: Request, context: { params: Promise<{ slug: string }> }) {
  const authUser = await authenticateRequest(req);
  const mockRole = await getMockRole();
  const effectiveAuthUser: AuthUser | null =
    authUser ??
    (mockRole ? { id: "mock-user", email: "mock@local", isGlobalAdmin: mockRole === "admin" } : null);
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
  const actor = await resolveActor(effectiveAuthUser as AuthUser);
  const creatorUserId = current.createdByUserId ?? current.assignedToUserId ?? actor.actorId ?? null;
  const creatorName = current.createdByName ?? current.assignedToName ?? actor.actorName ?? null;
  const availableResponsibles = await listManualReleaseResponsibleOptions(current.clientSlug ?? null, [
    creatorUserId,
    current.assignedToUserId,
  ]);
  const availableResponsiblesById = new Map(availableResponsibles.map((item) => [item.userId, item]));
  const requestedAssignedToUserId =
    body.assignedToUserId === undefined
      ? undefined
      : typeof body.assignedToUserId === "string"
        ? body.assignedToUserId.trim() || null
        : body.assignedToUserId == null
          ? null
          : "__invalid__";
  if (requestedAssignedToUserId === "__invalid__") {
    return NextResponse.json({ message: "Responsavel invalido" }, { status: 400 });
  }
  const fallbackAssignedToUserId = current.assignedToUserId ?? creatorUserId ?? null;
  const resolvedAssignedToUserId =
    requestedAssignedToUserId === undefined
      ? fallbackAssignedToUserId
      : requestedAssignedToUserId || creatorUserId || null;
  if (resolvedAssignedToUserId && !availableResponsiblesById.has(resolvedAssignedToUserId)) {
    return NextResponse.json({ message: "Responsavel precisa estar vinculado a empresa." }, { status: 400 });
  }
  const resolvedAssignedToName = resolvedAssignedToUserId
    ? availableResponsiblesById.get(resolvedAssignedToUserId)?.name ?? current.assignedToName ?? creatorName
    : creatorName;

  const nextKind = body.kind === "defect" ? "defect" : body.kind === "run" ? "run" : resolveManualReleaseKind(current);
  const nextStatusRaw = typeof body.status === "string" ? body.status : null;
  let nextStatus: ReleaseStatus | null = null;
  if (nextKind === "defect") {
    nextStatus = nextStatusRaw ? normalizeDefectStatus(nextStatusRaw) : null;
  } else {
    nextStatus = (nextStatusRaw as ReleaseStatus) ?? null;
  }

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

  const nextName =
    typeof body.name === "string" ? body.name : typeof body.title === "string" ? body.title : current.name;
  const nextRunSlug = typeof body.runSlug === "string" ? body.runSlug : current.runSlug;

  const updated: Release = {
    ...current,
    name: nextName,
    qaseProject:
      typeof body.qaseProject === "string"
        ? body.qaseProject.trim().toUpperCase()
        : typeof body.qase_project_code === "string"
          ? body.qase_project_code.trim().toUpperCase()
          : current.qaseProject,
    status: nextStatus ?? current.status,
    runSlug: nextRunSlug,
    runName: typeof body.runName === "string" ? body.runName : current.runName,
    stats: statsPatch,
    kind: nextKind,
    createdByUserId: creatorUserId,
    createdByName: creatorName,
    assignedToUserId: resolvedAssignedToUserId,
    assignedToName: resolvedAssignedToName,
    closedAt,
    updatedAt: now,
  };

  releases[index] = updated;
  await writeManualReleases(releases);
  if (nextKind === "run") {
    try {
      await notifyManualRunFailure(updated);
    } catch (err) {
      console.error("Falha ao notificar falha de run", err);
    }
  }
  if (nextKind === "defect") {
    try {
      const actor = await resolveActor(effectiveAuthUser as AuthUser);
      const prevStatus = normalizeDefectStatus(current.status);
      const nextStatusFinal = normalizeDefectStatus(updated.status);
      const prevRun = typeof current.runSlug === "string" ? current.runSlug : null;
      const nextRun = typeof updated.runSlug === "string" ? updated.runSlug : null;
      if (prevStatus !== nextStatusFinal) {
        await appendDefectHistory(updated.slug, {
          action: "status_changed",
          actorId: actor.actorId,
          actorName: actor.actorName,
          fromStatus: prevStatus,
          toStatus: nextStatusFinal,
        });
      }
      if (prevRun !== nextRun) {
        await appendDefectHistory(updated.slug, {
          action: nextRun ? "run_linked" : "run_unlinked",
          actorId: actor.actorId,
          actorName: actor.actorName,
          fromRunSlug: prevRun,
          toRunSlug: nextRun,
        });
      }
      if (nextName !== current.name) {
        await appendDefectHistory(updated.slug, {
          action: "updated",
          actorId: actor.actorId,
          actorName: actor.actorName,
          note: `Nome atualizado: ${current.name} -> ${nextName}`,
        });
      }
    } catch (err) {
      console.warn("Falha ao registrar historico do defeito:", err);
    }
  }
  return NextResponse.json({
    ...updated,
    kind: resolveManualReleaseKind(updated),
    ...(await buildResponsiblePayload(updated)),
  });
}

export async function DELETE(req: Request, context: { params: Promise<{ slug: string }> }) {
  const authUser = await authenticateRequest(req);
  const mockRole = await getMockRole();
  const effectiveAuthUser: AuthUser | null =
    authUser ??
    (mockRole ? { id: "mock-user", email: "mock@local", isGlobalAdmin: mockRole === "admin" } : null);
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
  if (resolveManualReleaseKind(target) === "defect") {
    try {
      const actor = await resolveActor(effectiveAuthUser as AuthUser);
      await appendDefectHistory(target.slug, {
        action: "deleted",
        actorId: actor.actorId,
        actorName: actor.actorName,
        note: target.name ?? null,
      });
    } catch (err) {
      console.warn("Falha ao registrar historico do defeito:", err);
    }
  }
  return NextResponse.json({ ok: true });
}
