import { apiFail, apiOk } from "@/lib/apiResponse";
import { getQualityRun, updateQualityRunStatus } from "@/lib/runOperationStore";
import { requirePermission } from "@/lib/rbac/requirePermission";
import type { TestRunStatus } from "@/data/runOperationModel";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function actorFrom(request: Request, body?: Record<string, unknown>) {
  return text(body?.actorId) || text(request.headers.get("x-user-id")) || text(request.headers.get("x-actor-id")) || "system";
}

function isRunStatus(value: unknown): value is TestRunStatus {
  return value === "draft" || value === "scheduled" || value === "in_progress" || value === "paused" || value === "completed" || value === "cancelled" || value === "aborted";
}

export async function GET(request: Request, { params }: Params) {
  try {
    const guard = await requirePermission(request, "runs", "view");
    if (!guard.ok) return guard.response;

    const run = await getQualityRun((await params).id);
    if (!run) {
      return apiFail(request, "Run não encontrada", { status: 404, code: "RUN_NOT_FOUND" });
    }
    return apiOk(request, { run }, "Run carregada");
  } catch (error) {
    console.error("[quality/runs/:id] GET error", error);
    return apiFail(request, "Erro ao carregar run", { status: 500, code: "RUN_GET_ERROR", details: error });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "runs", "edit");
  if (!guard.ok) return guard.response;

  const body = asRecord(await request.json().catch(() => null));
  try {
    if (!isRunStatus(body.status)) {
      return apiFail(request, "Status inválido para run", { status: 400, code: "RUN_STATUS_INVALID" });
    }
    const result = await updateQualityRunStatus((await params).id, body.status, actorFrom(request, body), text(body.reason) || null);
    if (!result.ok) {
      return apiFail(request, result.error, { status: result.status, code: "RUN_STATUS_ERROR" });
    }
    return apiOk(request, { run: result.run }, "Status da run atualizado");
  } catch (error) {
    console.error("[quality/runs/:id] PATCH error", error);
    return apiFail(request, "Erro ao atualizar run", { status: 500, code: "RUN_STATUS_UPDATE_ERROR", details: error });
  }
}



