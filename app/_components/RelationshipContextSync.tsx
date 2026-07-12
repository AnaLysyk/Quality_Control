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

    window.addEventListener("qc:relationships-changed", refreshRelationshipContexts);
    return () => window.removeEventListener("qc:relationships-changed", refreshRelationshipContexts);
  }, [refreshClients, refreshProjects]);

  return null;
}
