"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { FiActivity, FiInbox } from "react-icons/fi";

import { useAutomationModuleContext } from "../_components/AutomationModuleContext";
import AutomationQueueBoard from "../AutomationQueueBoard";

const BiometricAutomationRunner = dynamic(() => import("../BiometricAutomationRunner"), {
  loading: () => (
    <div className="h-[520px] animate-pulse rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)]" />
  ),
  ssr: false,
});

export default function AutomacoesExecucoesPage() {
  const { access, clients, activeClient } = useAutomationModuleContext();
  const [tab, setTab] = useState<"queue" | "biometrics">("queue");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-[18px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-2">
        <button
          type="button"
          onClick={() => setTab("queue")}
          className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ${
            tab === "queue" ? "bg-[#fff5f5] text-[var(--tc-accent,#ef0001)]" : "text-[var(--tc-text,#0b1a3c)]"
          }`}
        >
          <FiInbox className="h-4 w-4" />
          Fila de automação
        </button>
        <button
          type="button"
          onClick={() => setTab("biometrics")}
          className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ${
            tab === "biometrics" ? "bg-[#fff5f5] text-[var(--tc-accent,#ef0001)]" : "text-[var(--tc-text,#0b1a3c)]"
          }`}
        >
          <FiActivity className="h-4 w-4" />
          Execuções biométricas
        </button>
      </div>

      {tab === "queue" ? (
        <AutomationQueueBoard activeCompanySlug={activeClient?.slug ?? null} />
      ) : (
        <BiometricAutomationRunner
          activeCompanySlug={activeClient?.slug ?? null}
          canConfigure={access.canConfigure}
          companies={clients.map((company) => ({ name: company.name, slug: company.slug }))}
        />
      )}
    </div>
  );
}


