import { apiFail, apiOk } from "@/lib/apiResponse";
import { updateRunItemResult } from "@/lib/runOperationStore";
import type { QaseResultSyncStatus, TestRunItemStatus } from "@/data/runOperationModel";

export const dynamic = "force-dynamic";

type Params = { params: { id: string; itemId: string } };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function actorFrom(request: Request, body?: Record<string, unknown>) {
  return text(body?.actorId) || text(request.headers.get("x-user-id")) || text(request.headers.get("x-actor-id")) || "system";
}

function isItemStatus(value: unknown): value is TestRunItemStatus {
  return value === "not_run" || value === "in_progress" || value === "passed" || value === "failed" || value === "blocked" || value === "skipped" || value === "retest";
}

function isQaseSyncStatus(value: unknown): value is QaseResultSyncStatus {
  return value === "pending" || value === "synced" || value === "failed" || value === "skipped";
}

export async function PATCH(request: Request, { params }: Params) {
  const body = asRecord(await request.json().catch(() => null));
  try {
    if (!isItemStatus(body.status)) {
      return apiFail(request, "Status inválido para item da run", { status: 400, code: "RUN_ITEM_STATUS_INVALID" });
    }

    const result = await updateRunItemResult({
      runId: params.id,
      runItemId: params.itemId,
      status: body.status,
      actorId: actorFrom(request, body),
      executorId: text(body.executorId) || null,
      actualResult: text(body.actualResult) || null,
      failureReason: text(body.failureReason) || null,
      blockedReason: text(body.blockedReason) || null,
      skipReason: text(body.skipReason) || null,
      notes: text(body.notes) || null,
      evidenceIds: Array.isArray(body.evidenceIds) ? (body.evidenceIds as string[]) : [],
      evidences: Array.isArray(body.evidences) ? (body.evidences as any[]) : [],
      defectId: text(body.defectId) || null,
      qaseResultId: body.qaseResultId == null ? null : String(body.qaseResultId),
      qaseSyncStatus: isQaseSyncStatus(body.qaseSyncStatus) ? body.qaseSyncStatus : null,
      qaseSyncError: text(body.qaseSyncError) || null,
      qaseSyncedAt: text(body.qaseSyncedAt) || null,
      startedAt: text(body.startedAt) || null,
      finishedAt: text(body.finishedAt) || null,
      durationSeconds: typeof body.durationSeconds === "number" ? body.durationSeconds : null,
    });

    if (!result.ok) {
      return apiFail(request, result.error, { status: result.status, code: "RUN_ITEM_RESULT_ERROR" });
    }

    return apiOk(request, { run: result.run, item: result.item, attempt: result.attempt }, "Resultado do item atualizado");
  } catch (error) {
    console.error("[quality/runs/:id/items/:itemId/result] PATCH error", error);
    return apiFail(request, "Erro ao atualizar resultado do item", { status: 500, code: "RUN_ITEM_RESULT_UPDATE_ERROR", details: error });
  }
}
