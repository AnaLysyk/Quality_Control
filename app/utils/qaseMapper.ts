import { KanbanData } from "@/types/kanban";

type RawQaseEntity = {
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
      id: item.case_id ?? 0,
      title: item.title ?? "",
      bug: item.bug ?? null,
    });
  });

  return data;
}

export async function mapQaseToKanbanWithTitles(project: string, raw: RawQaseEntity[]) {
  // Sem transformação extra além da já aplicada; tipos explícitos para evitar any
  return mapQaseToKanban(raw);
}
