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
        className="relationship-company-history-launcher"
        onClick={() => setHistoryOpen(true)}
      >
        <FiClock />
        <span>Histórico por empresa</span>
      </button>

      <RelationshipManagementClientV4 />
      <RelationshipHistoryByCompanyPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
