"use client";

import type { MouseEvent } from "react";
import { useEffect, useState } from "react";

import RelationshipHistoryByCompanyPanel from "./RelationshipHistoryByCompanyPanel";
import RelationshipManagementClientV4 from "./RelationshipManagementClientV4";

const RELATIONSHIP_CHANGED_EVENT = "qc:relationships-changed";

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

  useEffect(() => {
    const handlePageShow = () => refreshRelationshipContext();
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  function handleWorkspaceClickCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const historyTrigger = target.closest(".relationship-history-trigger");
    if (!historyTrigger) return;

    event.preventDefault();
    event.stopPropagation();
    setHistoryOpen(true);
  }

  return (
    <div className="relationship-workspace" onClickCapture={handleWorkspaceClickCapture}>
      <RelationshipManagementClientV4 />
      <RelationshipHistoryByCompanyPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
