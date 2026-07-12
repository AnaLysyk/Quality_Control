"use client";

import type { MouseEvent } from "react";
import { useState } from "react";

import RelationshipHistoryByCompanyPanel from "./RelationshipHistoryByCompanyPanel";
import RelationshipManagementClientV4 from "./RelationshipManagementClientV4";

export default function RelationshipManagementWorkspace() {
  const [historyOpen, setHistoryOpen] = useState(false);

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
