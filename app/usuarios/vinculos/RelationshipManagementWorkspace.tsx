"use client";

import type { MouseEvent } from "react";
import { useEffect, useState } from "react";

import RelationshipHistoryByCompanyPanel from "./RelationshipHistoryByCompanyPanel";
import RelationshipManagementClientV4 from "./RelationshipManagementClientV4";

function invalidateRelationshipContextCaches() {
  try {
    sessionStorage.removeItem("qc:auth_me:v1");
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (!key) continue;
      if (key.startsWith("projects:") || key.startsWith("activeProject:")) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }

  window.dispatchEvent(new Event("qc:permissions-changed"));
  window.dispatchEvent(new Event("qc:relationships-changed"));
}

export default function RelationshipManagementWorkspace() {
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    const handlePageHide = () => invalidateRelationshipContextCaches();
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      invalidateRelationshipContextCaches();
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
