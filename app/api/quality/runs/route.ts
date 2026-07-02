import { apiFail, apiOk } from "@/lib/apiResponse";
import { createQualityRun, listQualityRuns } from "@/lib/runOperationStore";

export const dynamic = "force-dynamic";

type BodyRecord = Record<string, unknown>;

function asRecord(value: unknown): BodyRecord {
  return value && typeof value === "object" ? (value as BodyRecord) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberParam(value: string | null, fallback = 50) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function actorFrom(request: Request, body?: BodyRecord) {
  return text(body?.actorId) || text(request.headers.get("x-user-id")) || text(request.headers.get("x-actor-id")) || "system";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const runs = await listQualityRuns({
      companyId: text(url.searchParams.get("companyId")) || null,
      projectId: text(url.searchParams.get("projectId")) || null,
      planId: text(url.searchParams.get("planId")) || null,
      status: text(url.searchParams.get("status")) || null,
      limit: numberParam(url.searchParams.get("limit"), 50),
    });
    return apiOk(request, { items: runs, total: runs.length }, "Runs carregadas");
  } catch (error) {
    console.error("[quality/runs] GET error", error);
    return apiFail(request, "Erro ao carregar runs", { status: 500, code: "RUNS_LIST_ERROR", details: error });
  }
}

export async function POST(request: Request) {
  const body = asRecord(await request.json().catch(() => null));
  try {
    const result = await createQualityRun({
      companyId: text(body.companyId),
      projectId: text(body.projectId),
      planId: text(body.planId),
      planSnapshotId: text(body.planSnapshotId) || null,
      title: text(body.title),
      description: text(body.description) || null,
      runType: body.runType === "automated" || body.runType === "hybrid" || body.runType === "assisted_by_brian" ? body.runType : "manual",
      source: body.source === "qase" || body.source === "playwright" || body.source === "brian" || body.source === "import" ? body.source : "local",
      runOwnerId: text(body.runOwnerId) || null,
      actorId: actorFrom(request, body),
      environment: text(body.environment) || null,
      buildVersion: text(body.buildVersion) || null,
      qaseRunId: body.qaseRunId == null ? null : String(body.qaseRunId),
      qaseProjectCode: text(body.qaseProjectCode) || null,
      cases: Array.isArray(body.cases) ? (body.cases as any[]) : [],
    });

    if (!result.ok) {
      return apiFail(request, result.error, { status: 400, code: "RUN_VALIDATION_ERROR" });
    }

    return apiOk(request, { run: result.run }, "Run criada", { status: 201 });
  } catch (error) {
    console.error("[quality/runs] POST error", error);
    return apiFail(request, "Erro ao criar run", { status: 500, code: "RUN_CREATE_ERROR", details: error });
  }
}

