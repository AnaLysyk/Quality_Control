import { KanbanData } from "@/types/kanban";

export type RawQaseEntity = {
  case_id?: number;
  status?: string;
  title?: string;
  bug?: string | null;
};

export function mapQaseToKanban(entities: RawQaseEntity[]): KanbanData {
  const data: KanbanData = {
    pass: [],
    fail: [],
    blocked: [],
    notRun: [],
  };

  entities.forEach((item) => {
    if (!item.case_id || !Number.isFinite(Number(item.case_id))) return;
    const status = (item.status ?? "").toLowerCase();
    const bucket: keyof KanbanData =
      status === "passed"
        ? "pass"
        : status === "failed"
        ? "fail"
        : status === "blocked"
        ? "blocked"
        : "notRun";

    data[bucket].push({
      id: item.case_id,
      title: item.title ?? "",
      bug: item.bug ?? null,
      fromApi: true,
    });
  });

  return data;
}

export async function mapQaseToKanbanWithTitles(project: string, raw: RawQaseEntity[]) {
  // Sem transformação extra além da já aplicada; tipos explícitos para evitar any
  return mapQaseToKanban(raw);
}
