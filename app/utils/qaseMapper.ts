// app/utils/qaseMapper.ts

import { KanbanData, KanbanItem } from "@/types/kanban";

const normalizeStatus = (status: string): keyof KanbanData => {
  const s = status.toLowerCase();

  if (s === "passed") return "pass";
  if (s === "failed") return "fail";
  if (s === "blocked") return "blocked";

  // skipped, untested, etc.
  return "notRun";
};

export function mapQaseToKanban(entities: any[]): KanbanData {
  const data: KanbanData = {
    pass: [],
    fail: [],
    blocked: [],
    notRun: [],
  };

  entities.forEach((e) => {
    const status = normalizeStatus(e.status);

    const item: KanbanItem = {
      id: e.case_id,
      title: e.title,
      bug: e.bug_id ? `#${e.bug_id}` : null,
    };

    data[status].push(item);
  });

  return data;
}
