import { QaseClient } from "@/lib/qaseSdk";
import { externalFailure, externalSuccess, type ExternalServiceResult } from "@/lib/external";

export type QaseRunRecord = {
  id: number;
  slug: string;
  name: string;
  status: string | undefined;
  createdAt: string | undefined;
};

function normalizeRunName(value?: unknown) {
  if (!value) return null;
  const trimmed = value.toString().trim();
  return trimmed.length ? trimmed : null;
}

export async function listQaseRuns(projectCode?: string | null, token?: string | null): Promise<ExternalServiceResult<QaseRunRecord[]>> {
  if (!projectCode || !token) {
    return externalFailure("Qase nao configurado (token/projeto ausente)", []);
  }
  const client = new QaseClient({ token });
  try {
    const response = await client.listRuns(projectCode, { limit: 500 });
    const entities = response.result?.entities ?? [];
    const mapped = entities
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const raw = entry as Record<string, unknown>;
        const idValue = raw.id ?? raw.run_id ?? raw.runId;
        const id = typeof idValue === "number" ? idValue : typeof idValue === "string" ? Number(idValue) : NaN;
        if (Number.isNaN(id)) return null;
        return {
          id,
          slug: normalizeRunName(raw.slug ?? raw.code ?? raw.name) ?? `qase-run-${id}`,
          name: normalizeRunName(raw.name ?? raw.title) ?? `Run ${id}`,
          status: normalizeRunName(raw.status ?? raw.state) ?? undefined,
          createdAt:
            typeof raw.started_at === "string"
              ? raw.started_at
              : typeof raw.created_at === "string"
              ? raw.created_at
              : undefined,
        };
      })
      .filter((entry): entry is QaseRunRecord => entry !== null);
    return externalSuccess(mapped);
  } catch (error) {
    console.error(`[QASE][RUNS] Unable to list runs for project ${projectCode}:`, error);
    return externalFailure("Falha ao listar runs no Qase", []);
  }
}
