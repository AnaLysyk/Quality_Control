import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { appendDefectHistory, listDefectHistory } from "@/lib/manualDefectHistoryStore";
import { encodeDefectAssigneeNote, summarizeDefectActivity } from "@/lib/defectActivity";
import {
  canAccessCompanyDefects,
  pickDefectNotificationShape,
  resolveAccessibleCompanyDefect,
  resolveDefectActor,
} from "@/lib/companyDefectsAccess";
import { listManualReleaseResponsibleOptions } from "@/lib/manualReleaseResponsible";
import { canEditManualDefect, resolveDefectRole } from "@/lib/rbac/defects";
import { notifyDefectAssigned } from "@/lib/notificationService";
import { invalidateCompanyDefectsDataset } from "@/lib/companyDefectsDataset";

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  }

  const { slug } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const companySlug = normalizeString(body?.companySlug);

  if (!companySlug) {
    return NextResponse.json({ message: "Empresa não informada" }, { status: 400 });
  }
  if (!canAccessCompanyDefects(user, companySlug)) {
    return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
  }

  const role = await resolveDefectRole(user, companySlug);
  if (!canEditManualDefect(role)) {
    return NextResponse.json({ message: "Sem permissão para atribuir responsável" }, { status: 403 });
  }

  const defect = await resolveAccessibleCompanyDefect(companySlug, slug);
  if (!defect) {
    return NextResponse.json({ message: "Defeito não encontrado" }, { status: 404 });
  }
  if (defect.sourceType !== "qase") {
    return NextResponse.json({ message: "Atribuicao local só e usada para defeitos integrados" }, { status: 400 });
  }

  const requestedAssigneeId =
    body?.assignedToUserId === null
      ? null
      : normalizeString(body?.assignedToUserId);
  const options = await listManualReleaseResponsibleOptions(companySlug);
  const nextAssignee = requestedAssigneeId ? options.find((option) => option.userId === requestedAssigneeId) ?? null : null;

  if (requestedAssigneeId && !nextAssignee) {
    return NextResponse.json({ message: "Responsável precisa estar vinculado a empresa" }, { status: 400 });
  }

  const actor = await resolveDefectActor(user);
  const event = await appendDefectHistory(defect.slug, {
    action: "assignee_changed",
    actorId: actor.actorId,
    actorName: actor.actorName,
    note: encodeDefectAssigneeNote({
      userId: nextAssignee?.userId ?? null,
      userName: nextAssignee?.name ?? null,
    }),
  });
  if (!event) {
    return NextResponse.json({ message: "Não foi possível salvar o responsável" }, { status: 500 });
  }

  invalidateCompanyDefectsDataset(companySlug);

  if (nextAssignee?.userId) {
    void notifyDefectAssigned({
      defect: pickDefectNotificationShape(defect),
      companySlug,
      actorId: actor.actorId ?? "",
      assigneeId: nextAssignee.userId,
      assigneeName: nextAssignee.name,
    }).catch(() => null);
  }

  const summary = summarizeDefectActivity(await listDefectHistory(defect.slug));
  return NextResponse.json({
    summary,
  });
}
