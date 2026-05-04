import "server-only";
import { Suspense } from "react";
import { getQaseRunKanban } from "@/integrations/qase";
import { RunDetailKanbanSection } from "@/components/RunDetailKanbanSection";
import type { KanbanData } from "@/types/kanban";

type Props = {
  projectKey: string;
  projectCode: string;
  runId: number;
  companySlug?: string;
  persistEndpoint?: string;
  editable: boolean;
  allowStatusChange: boolean;
  allowLinkEdit: boolean;
};

async function KanbanLoader(props: Props) {
  let kanbanData: KanbanData = { pass: [], fail: [], blocked: [], notRun: [] };
  try {
    kanbanData = await getQaseRunKanban(props.projectCode, props.runId, props.companySlug);
  } catch {
    /* ignore — empty kanban */
  }

  return (
    <RunDetailKanbanSection
      data={kanbanData}
      project={props.projectKey}
      runId={props.runId}
      qaseProject={props.projectCode}
      companySlug={props.companySlug}
      persistEndpoint={props.persistEndpoint}
      editable={props.editable}
      allowStatusChange={props.allowStatusChange}
      allowLinkEdit={props.allowLinkEdit}
    />
  );
}

function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6 w-full animate-pulse">
      {(["Pass", "Fail", "Blocked", "Not Run"] as const).map((label) => (
        <div
          key={label}
          className="rounded-xl p-5 border border-slate-200 bg-slate-50 min-h-40 space-y-3"
        >
          <div className="h-5 w-20 rounded-full bg-slate-200" />
          <div className="h-4 w-full rounded-full bg-slate-100" />
          <div className="h-4 w-3/4 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function RunKanbanStream(props: Props) {
  return (
    <Suspense fallback={<KanbanSkeleton />}>
      <KanbanLoader {...props} />
    </Suspense>
  );
}
