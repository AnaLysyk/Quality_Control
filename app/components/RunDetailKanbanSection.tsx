"use client";

import { useState } from "react";
import Kanban from "./Kanban";
import { RunCasePanel } from "./RunCasePanel";
import type { KanbanData, KanbanItem } from "@/types/kanban";

type RunDetailKanbanSectionProps = {
  data: KanbanData;
  project: string;
  runId: number;
  qaseProject?: string;
  companySlug?: string;
  persistEndpoint?: string;
  editable?: boolean;
  allowStatusChange?: boolean;
  allowLinkEdit?: boolean;
};

export function RunDetailKanbanSection({
  data,
  project,
  runId,
  qaseProject,
  companySlug,
  persistEndpoint,
  editable,
  allowStatusChange,
  allowLinkEdit,
}: RunDetailKanbanSectionProps) {
  const [selectedCase, setSelectedCase] = useState<{
    item: KanbanItem;
    col: keyof KanbanData;
  } | null>(null);

  return (
    <>
      <Kanban
        data={data}
        project={project}
        runId={runId}
        qaseProject={qaseProject}
        companySlug={companySlug}
        persistEndpoint={persistEndpoint}
        editable={editable}
        allowStatusChange={allowStatusChange}
        allowLinkEdit={allowLinkEdit}
        onCardClick={(item, col) => setSelectedCase({ item, col })}
      />
      {selectedCase && (
        <RunCasePanel
          item={selectedCase.item}
          columnKey={selectedCase.col}
          projectCode={qaseProject ?? project}
          onClose={() => setSelectedCase(null)}
        />
      )}
    </>
  );
}
