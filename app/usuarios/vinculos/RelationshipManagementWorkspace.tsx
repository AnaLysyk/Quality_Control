"use client";

import type { MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";

import RelationshipHistoryByCompanyPanel from "./RelationshipHistoryByCompanyPanel";
import RelationshipManagementClientV4 from "./RelationshipManagementClientV4";

const RELATIONSHIP_CHANGED_EVENT = "qc:relationships-changed";
const MUTATION_ACTION_PATTERN = /confirmar projeto|confirmar remoção|confirmar liderança|adicionar ao projeto|transferir projeto|adicionar usuário/i;

function refreshRelationshipContext() {
  try {
    sessionStorage.removeItem("qc:auth_me:v1");
  } catch {
    // O cache pode estar indisponível em navegação privada.
  }

  window.dispatchEvent(new Event("qc:permissions-changed"));
  window.dispatchEvent(new Event(RELATIONSHIP_CHANGED_EVENT));
}

export default function RelationshipManagementWorkspace() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handlePageShow = () => refreshRelationshipContext();
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    };
  }, []);

  function scheduleRelationshipRefresh() {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshRelationshipContext();
      refreshTimerRef.current = window.setTimeout(refreshRelationshipContext, 900);
    }, 350);
  }

  function handleWorkspaceClickCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const historyTrigger = target.closest(".relationship-history-trigger");
    if (historyTrigger) {
      event.preventDefault();
      event.stopPropagation();
      setHistoryOpen(true);
      return;
    }

    const actionButton = target.closest("button");
    const actionLabel = actionButton?.textContent?.trim() ?? "";
    if (actionButton && MUTATION_ACTION_PATTERN.test(actionLabel)) {
      scheduleRelationshipRefresh();
    }
  }

  return (
    <div className="relationship-workspace" onClickCapture={handleWorkspaceClickCapture}>
      <RelationshipManagementClientV4 />
      <RelationshipHistoryByCompanyPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
