import { NextResponse } from "next/server";
import crypto from "crypto";
import { slugifyRelease } from "@/lib/slugifyRelease";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";
import { canCreateManualDefect, getMockRole, resolveDefectRole } from "@/lib/rbac/defects";
import type { Release, Stats } from "@/types/release";
import { normalizeDefectStatus, resolveClosedAt } from "@/lib/defectNormalization";
import { resolveManualReleaseKind } from "@/lib/manualReleaseKind";
import { readManualReleases, writeManualReleases } from "@/lib/manualReleaseStore";
import { notifyManualRunCreated } from "@/lib/notificationService";
import { appendDefectHistory } from "@/lib/manualDefectHistoryStore";
import { getLocalUserById } from "@/lib/auth/localStore";

async function resolveActor(authUser: AuthUser | null) {
  if (!authUser) return { actorId: null, actorName: null };
  const local = await getLocalUserById(authUser.id);
  return {
    actorId: authUser.id,
    actorName: local?.name ?? authUser.email ?? null,
  };
}

function shouldCloseFromStats(stats: Partial<Stats>) {
  const fail = Math.max(0, Number(stats.fail ?? 0));
  const blocked = Math.max(0, Number(stats.blocked ?? 0));
  const notRun = Math.max(0, Number(stats.notRun ?? 0));
  return fail === 0 && blocked === 0 && notRun === 0;
}

function resolveAllowedSlugs(user: AuthUser): string[] {
  if (Array.isArray(user.companySlugs) && user.companySlugs.length) return user.companySlugs;
  if (user.companySlug) return [user.companySlug];
  return [];
}

export async function GET(req: Request) {
  const authUser = await authenticateRequest(req);
  const mockRole = await getMockRole();
  const effectiveAuthUser =
    authUser ?? (mockRole ? { id: "mock-user", isGlobalAdmin: mockRole === "admin" } : null);
  if (!effectiveAuthUser) {
    return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
  }

  const releases = await readManualReleases();
  const url = new URL(req.url);
  const clientSlug = url.searchParams.get("clientSlug")?.trim() || null;
  const kindParam = url.searchParams.get("kind")?.trim().toLowerCase() || null;
  const kindFilter = kindParam === "defect" || kindParam === "run" ? kindParam : null;
  if (!effectiveAuthUser.isGlobalAdmin) {
    const allowed = resolveAllowedSlugs(effectiveAuthUser as AuthUser);
    if (clientSlug && !allowed.includes(clientSlug)) {
      return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
    }
  }

  let filtered = clientSlug
    ? releases.filter((r) => (r.clientSlug ?? null) === clientSlug)
    : effectiveAuthUser.isGlobalAdmin
      ? releases
      : releases.filter((r) => !r.clientSlug || resolveAllowedSlugs(effectiveAuthUser as AuthUser).includes(r.clientSlug));
  if (kindFilter) {
    filtered = filtered.filter((r) => resolveManualReleaseKind(r) === kindFilter);
  }
  const normalized = filtered.map((r) => ({
    ...r,
    kind: resolveManualReleaseKind(r),
    id: r.slug ?? r.id,
    metrics: {
      pass: r.stats.pass,
      fail: r.stats.fail,
      blocked: r.stats.blocked,
      not_run: r.stats.notRun,
      total: r.stats.pass + r.stats.fail + r.stats.blocked + r.stats.notRun,
      passRate:
        r.stats.pass + r.stats.fail + r.stats.blocked + r.stats.notRun > 0
          ? Math.round((r.stats.pass / (r.stats.pass + r.stats.fail + r.stats.blocked + r.stats.notRun)) * 100)
          : 0,
    },
  }));
  return NextResponse.json(normalized);
}

export async function POST(req: Request) {
  const authUser = await authenticateRequest(req);
  const mockRole = await getMockRole();
  const effectiveAuthUser =
    authUser ?? (mockRole ? { id: "mock-user", isGlobalAdmin: mockRole === "admin" } : null);
  if (!effectiveAuthUser) return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
  try {
    const body = await req.json();
    const name = (body.name ?? "").toString().trim();
    const app = (body.app ?? "").toString().trim() || "SMART";
    const environments = Array.isArray(body.environments) ? body.environments.map((env: unknown) => String(env)) : [];
    const clientSlug = body.clientSlug ? String(body.clientSlug).trim() : null;
    const role = await resolveDefectRole(effectiveAuthUser, clientSlug);
    if (!canCreateManualDefect(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const kind = body.kind === "defect" ? "defect" : "run";
    const stats = (body.stats ?? {}) as Partial<Stats>;
    const now = new Date().toISOString();
    const requestedClosedAt = typeof body.closedAt === "string" ? body.closedAt : null;
    let status = normalizeDefectStatus(body.status);
    if (!body.status && shouldCloseFromStats(stats)) {
      status = "done";
    }
    const closedAt = resolveClosedAt(status, requestedClosedAt, shouldCloseFromStats(stats) ? now : null);

    if (!name) {
      return NextResponse.json({ message: "Nome obrigatorio" }, { status: 400 });
    }

    const release: Release = {
      id: crypto.randomUUID(),
      slug: body.slug ? slugifyRelease(body.slug) : slugifyRelease(name),
      name,
      app,
      kind,
      environments,
      clientSlug: clientSlug && clientSlug.length > 0 ? clientSlug : null,
      category: body.category ? String(body.category) : undefined,
      runSlug: body.runSlug ? String(body.runSlug) : undefined,
      runName: body.runName ? String(body.runName) : undefined,
      source: "MANUAL",
      status,
      stats: {
        pass: Math.max(0, Number(stats.pass ?? 0)),
        fail: Math.max(0, Number(stats.fail ?? (kind === "defect" ? 1 : 0))),
        blocked: Math.max(0, Number(stats.blocked ?? 0)),
        notRun: Math.max(0, Number(stats.notRun ?? 0)),
      },
      observations: body.observations ? String(body.observations) : undefined,
      closedAt,
      createdAt: now,
      updatedAt: now,
    };

    const releases = await readManualReleases();
    const filtered = releases.filter((r) => r.slug !== release.slug);
    filtered.unshift(release);
    await writeManualReleases(filtered);

    if (kind === "run") {
      try {
        await notifyManualRunCreated(release);
      } catch (err) {
        console.error("Falha ao enviar notificacoes de run", err);
      }
    }
    if (kind === "defect") {
      try {
        const actor = await resolveActor(effectiveAuthUser);
        await appendDefectHistory(release.slug, {
          action: "created",
          actorId: actor.actorId,
          actorName: actor.actorName,
          toStatus: release.status ?? null,
          toRunSlug: release.runSlug ?? null,
          note: release.name ?? null,
        });
      } catch (err) {
        console.warn("Falha ao registrar historico do defeito:", err);
      }
    }

    const total = release.stats.pass + release.stats.fail + release.stats.blocked + release.stats.notRun;
    const payload = {
      ...release,
      id: release.slug ?? release.id,
      metrics: {
        pass: release.stats.pass,
        fail: release.stats.fail,
        blocked: release.stats.blocked,
        not_run: release.stats.notRun,
        total,
        passRate: total > 0 ? Math.round((release.stats.pass / total) * 100) : 0,
      },
    };

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    console.error("POST /releases-manual error", error);
    return NextResponse.json({ message: "Erro ao salvar release manual" }, { status: 500 });
  }
}
