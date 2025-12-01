// app/services/qase.ts

import { mapQaseToKanban } from "@/utils/qaseMapper";
import { KanbanData } from "@/types/kanban";

const API_BASE = "https://api.qase.io/v1";

const headers = {
  Accept: "application/json",
  Token: process.env.NEXT_PUBLIC_QASE_TOKEN!,
};

// 1) DETALHES DA RUN (título, descrição, stats)
export async function getQaseRunStats(project: string, runId: number) {
  const res = await fetch(`${API_BASE}/run/${project}/${runId}`, {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Erro ao consultar run ${runId}: ${res.status}`);
  }

  const json = await res.json();
  return json.result;
}

// 2) RESULTADOS DA RUN (lista de casos)
export async function getQaseRunResults(project: string, runId: number) {
  const res = await fetch(`${API_BASE}/result/${project}?run_id=${runId}`, {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Erro ao consultar casos da run ${runId}: ${res.status}`);
  }

  const json = await res.json();

  // Qase: result.entities
  return json.result?.entities ?? [];
}

// 3) RESULTADOS → KANBAN
export async function getQaseRunKanban(
  project: string,
  runId: number
): Promise<KanbanData> {
  const raw = await getQaseRunResults(project, runId);
  return mapQaseToKanban(raw);
}
