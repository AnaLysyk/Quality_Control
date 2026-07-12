"use client";

import { useState } from "react";
import { FiClock } from "react-icons/fi";

import RelationshipHistoryByCompanyPanel from "./RelationshipHistoryByCompanyPanel";
import RelationshipManagementClientV4 from "./RelationshipManagementClientV4";

export default function RelationshipManagementWorkspace() {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <div className="relationship-workspace">
      <button
        type="button"
        className="relationship-profile-history-launcher"
        onClick={() => setHistoryOpen(true)}
        aria-label="Abrir histórico por perfil"
        title="Histórico por perfil"
      >
        <FiClock aria-hidden="true" />
      </button>

      <RelationshipManagementClientV4 />
      <RelationshipHistoryByCompanyPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
