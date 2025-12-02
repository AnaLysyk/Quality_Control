// app/services/qase.ts

import { mapQaseToKanban } from "@/utils/qaseMapper";
import { KanbanData } from "@/types/kanban";

const API_BASE = "https://api.qase.io/v1";

const headers = {
  Accept: "application/json",
  Token: process.env.NEXT_PUBLIC_QASE_TOKEN!,
};

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

export async function getQaseRunResults(project: string, runId: number) {
  const res = await fetch(`${API_BASE}/result/${project}?run_id=${runId}`, {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Erro ao consultar casos da run ${runId}: ${res.status}`);
  }

  const json = await res.json();
  return json.result?.entities ?? [];
}

export async function getQaseRunCases(project: string, runId: number) {
  const pageSize = 200;
  let page = 1;
  const allCases: any[] = [];
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(
      `${API_BASE}/run/${project}/${runId}/cases?page=${page}&limit=${pageSize}`,
      {
        headers,
        cache: "no-store",
      }
    );

    if (res.status === 404) {
      return getQaseRunResults(project, runId);
    }

    if (!res.ok) {
      throw new Error(`Erro ao consultar casos da run ${runId}: ${res.status}`);
    }

    const json = await res.json();
    const entities = json.result?.entities ?? [];
    allCases.push(...entities);

    if (entities.length < pageSize) {
      hasMore = false;
    } else {
      page += 1;
    }
  }

  return allCases;
}

export async function getQaseRunKanban(
  project: string,
  runId: number
): Promise<KanbanData> {
  const raw = await getQaseRunCases(project, runId);
  return mapQaseToKanban(raw);
}
