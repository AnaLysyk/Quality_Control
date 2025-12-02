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
      bug: e.defect ?? null,
    };

    data[status].push(item);
  });

  return data;
}
export async function mapQaseToKanbanWithTitles(project: string, raw: any[]) {
  const items = await Promise.all(
    raw.map(async (r) => {
      const res = await fetch(
        `https://api.qase.io/v1/case/${project}/${r.case_id}`,
        {
          headers: {
            Accept: "application/json",
            Token: process.env.NEXT_PUBLIC_QASE_TOKEN!,
          },
          cache: "no-store",
        }
      );

      const caseJson = await res.json();

      return {
        id: r.case_id,
        title: caseJson.result?.title || `Caso ${r.case_id}`,
        bug: r.bug_id ? `#${r.bug_id}` : null,
        status: r.status,
      };
    })
  );

  // agora distribui nos grupos
  const mapped: KanbanData = {
    pass: [],
    fail: [],
    blocked: [],
    notRun: [],
  };

  items.forEach((i) => {
    const s = i.status.toLowerCase();
    if (s === "passed") mapped.pass.push(i);
    else if (s === "failed") mapped.fail.push(i);
    else if (s === "blocked") mapped.blocked.push(i);
    else mapped.notRun.push(i);
  });

  return mapped;
}
