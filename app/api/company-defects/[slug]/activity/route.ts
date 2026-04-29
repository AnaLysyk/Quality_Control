import { NextResponse } from "next/server";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";
import { getLocalUserById } from "@/lib/auth/localStore";
import { listDefectHistory } from "@/lib/manualDefectHistoryStore";
import { buildDefectComments, summarizeDefectActivity } from "@/lib/defectActivity";
import { getIntegratedDefectQaseHistory } from "@/lib/companyDefects";
import {
  canAccessCompanyDefects,
  resolveAccessibleCompanySlug,
  resolveAccessibleCompanyDefect,
} from "@/lib/companyDefectsAccess";

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

async function enrichActorNames(items: Awaited<ReturnType<typeof listDefectHistory>>) {
  const actorIds = Array.from(new Set(items.map((item) => item.actorId).filter((value): value is string => Boolean(value))));
  const actors = await Promise.all(actorIds.map((actorId) => getLocalUserById(actorId)));
  const actorMap = new Map(actorIds.map((actorId, index) => [actorId, actors[index] ?? null]));

  return items.map((item) => {
    if (item.actorName || !item.actorId) return item;
    const actor = actorMap.get(item.actorId) ?? null;
    if (!actor) return item;
    return {
      ...item,
      actorName: actor.full_name?.trim() || actor.name || actor.email || item.actorId,
    };
  });
}

function resolveCompanySlug(url: URL, user: AuthUser) {
  const requested = normalizeString(url.searchParams.get("companySlug"));
  if (requested && canAccessCompanyDefects(user, requested)) return requested;
  return resolveAccessibleCompanySlug(user);
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const companySlug = resolveCompanySlug(url, user);
  if (!companySlug) {
    return NextResponse.json({ message: "Empresa não informada" }, { status: 400 });
  }
  if (!canAccessCompanyDefects(user, companySlug)) {
    return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
  }

  const { slug } = await context.params;
  const defect = await resolveAccessibleCompanyDefect(companySlug, slug);
  if (!defect) {
    return NextResponse.json({ message: "Defeito não encontrado" }, { status: 404 });
  }

  const internalHistory = await enrichActorNames(await listDefectHistory(defect.slug));
  const summary = summarizeDefectActivity(internalHistory);
  const comments = buildDefectComments(internalHistory);
  const qaseHistory =
    defect.sourceType === "qase"
      ? await getIntegratedDefectQaseHistory(companySlug, {
          id: defect.id,
          projectCode: defect.projectCode,
          status: defect.status,
          title: defect.title,
        })
      : { events: [], notice: null };
  const history = [...internalHistory, ...qaseHistory.events]
    .map((event) => ({
      ...event,
      source: event.actorName === "Qase" ? "qase" : "internal",
    }))
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));

  return NextResponse.json({
    defectSlug: defect.slug,
    comments,
    history,
    timelineNotice: qaseHistory.notice,
    summary: {
      ...summary,
      assignedToUserId: defect.sourceType === "manual" ? defect.assignedToUserId : summary.assignedToUserId,
      assignedToName: defect.sourceType === "manual" ? defect.assignedToName : summary.assignedToName,
    },
  });
}
