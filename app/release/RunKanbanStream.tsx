"use client";

import { useEffect, useMemo, useState } from "react";
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

const EMPTY_KANBAN: KanbanData = { pass: [], fail: [], blocked: [], notRun: [] };

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

function KanbanContent(props: Props) {
  const [kanbanData, setKanbanData] = useState<KanbanData>(EMPTY_KANBAN);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      project: props.projectCode,
      runId: String(props.runId),
    });
    if (props.companySlug) {
      params.set("companySlug", props.companySlug);
    }
    return params.toString();
  }, [props.companySlug, props.projectCode, props.runId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    fetch(`/api/runs/kanban?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<{ data?: KanbanData }>;
      })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setKanbanData(payload.data ?? EMPTY_KANBAN);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setKanbanData(EMPTY_KANBAN);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [query]);

  if (loading) {
    return <KanbanSkeleton />;
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

export function RunKanbanStream(props: Props) {
  return <KanbanContent {...props} />;
}
