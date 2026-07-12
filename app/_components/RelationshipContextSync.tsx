"use client";

import { useEffect } from "react";

import { useClientContext } from "@/context/ClientContext";
import { useProjectContext } from "@/lib/core/project/ProjectContext";

export function RelationshipContextSync() {
  const { refreshClients } = useClientContext();
  const { refreshProjects } = useProjectContext();

  useEffect(() => {
    let running = false;

    async function refreshRelationshipContexts() {
      if (running) return;
      running = true;
      try {
        await refreshClients();
        await refreshProjects();
      } finally {
        running = false;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshRelationshipContexts();
      }
    }

    void refreshRelationshipContexts();
    window.addEventListener("qc:relationships-changed", refreshRelationshipContexts);
    window.addEventListener("pageshow", refreshRelationshipContexts);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("qc:relationships-changed", refreshRelationshipContexts);
      window.removeEventListener("pageshow", refreshRelationshipContexts);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshClients, refreshProjects]);

  return null;
}
