import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { appendDefectHistory } from "@/lib/manualDefectHistoryStore";
import { buildDefectComments } from "@/lib/defectActivity";
import { invalidateCompanyDefectsDataset } from "@/lib/companyDefectsDataset";
import {
  canAccessCompanyDefects,
  pickDefectNotificationShape,
  resolveAccessibleCompanyDefect,
  resolveDefectActor,
} from "@/lib/companyDefectsAccess";
import { notifyDefectCommentAdded } from "@/lib/notificationService";

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const { slug } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const companySlug = normalizeString(body?.companySlug);
  const commentBody = normalizeString(body?.body);

  if (!companySlug) {
    return NextResponse.json({ message: "Empresa não informada" }, { status: 400 });
  }
  if (!canAccessCompanyDefects(user, companySlug)) {
    return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
  }
  if (!commentBody) {
    return NextResponse.json({ message: "Comentário obrigatório" }, { status: 400 });
  }

  const defect = await resolveAccessibleCompanyDefect(companySlug, slug);
  if (!defect) {
    return NextResponse.json({ message: "Defeito não encontrado" }, { status: 404 });
  }

  const actor = await resolveDefectActor(user);
  const event = await appendDefectHistory(defect.slug, {
    action: "comment_added",
    actorId: actor.actorId,
    actorName: actor.actorName,
    note: commentBody,
  });
  if (!event) {
    return NextResponse.json({ message: "Não foi possível salvar o comentário" }, { status: 500 });
  }

  invalidateCompanyDefectsDataset(companySlug);

  void notifyDefectCommentAdded({
    defect: pickDefectNotificationShape(defect),
    companySlug,
    actorId: actor.actorId ?? "",
    actorName: actor.actorName,
    commentId: event.id,
    body: commentBody,
  }).catch(() => null);

  return NextResponse.json({
    item: buildDefectComments([event])[0] ?? null,
  });
}
