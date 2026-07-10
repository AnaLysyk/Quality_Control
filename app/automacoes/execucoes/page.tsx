"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FiActivity, FiPlay } from "react-icons/fi";

import { useAutomationModuleContext } from "../_components/AutomationModuleContext";

const BiometricAutomationRunner = dynamic(() => import("../BiometricAutomationRunner"), {
  loading: () => (
    <div className="h-[520px] animate-pulse rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)]" />
  ),
  ssr: false,
});

const AutomationExecutionsDashboard = dynamic(() => import("./AutomationExecutionsDashboard"), {
  loading: () => (
    <div className="h-[520px] animate-pulse rounded-[28px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)]" />
  ),
  ssr: false,
});

type ViewMode = "dashboard" | "biometria";

const TABS: Array<{ view: ViewMode; label: string; icon: typeof FiActivity }> = [
  { view: "dashboard", label: "Dashboard de execuções", icon: FiActivity },
  { view: "biometria", label: "Runner biométrico", icon: FiPlay },
];

export default function AutomacoesExecucoesPage() {
  const { access, clients, activeClient } = useAutomationModuleContext();
  const searchParams = useSearchParams();
  const rawView = searchParams.get("view");
  const view: ViewMode = rawView === "biometria" ? "biometria" : "dashboard";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-[18px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = view === tab.view;
          const href = tab.view === "dashboard" ? "/automacoes/execucoes" : "/automacoes/execucoes?view=biometria";
          return (
            <Link
              key={tab.view}
              href={href}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${
                isActive ? "border-[var(--tc-accent,#ef0001)] bg-[#fff5f5] text-[var(--tc-accent,#ef0001)]" : "border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] text-[var(--tc-text,#0b1a3c)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {view === "dashboard" ? <AutomationExecutionsDashboard /> : null}

      {view === "biometria" ? (
        <BiometricAutomationRunner
          activeCompanySlug={activeClient?.slug ?? null}
          canConfigure={access.canConfigure}
          companies={clients.map((company) => ({ name: company.name, slug: company.slug }))}
        />
      ) : null}
    </div>
  );
}
