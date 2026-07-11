"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FiClipboard, FiCode, FiGitBranch, FiHash, FiServer } from "react-icons/fi";

import AutomationStudio from "../AutomationStudio";
import AutomationApiLab from "../AutomationApiLab";
import { AutomationGithubSender } from "../_components/AutomationGithubSender";
import { useAutomationModuleContext } from "../_components/AutomationModuleContext";

const Base64Studio = dynamic(() => import("../base64/Base64Studio"), { ssr: false });

type ViewMode = "flows" | "scripts" | "api-lab" | "base64";

const TABS: Array<{ view: ViewMode; label: string; icon: typeof FiGitBranch }> = [
  { view: "flows", label: "Fluxo", icon: FiGitBranch },
  { view: "scripts", label: "Script", icon: FiCode },
  { view: "api-lab", label: "API Lab", icon: FiServer },
  { view: "base64", label: "Base64/Documentos", icon: FiHash },
];

export default function AutomacoesUiStudioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { access, clients, activeClient } = useAutomationModuleContext();
  const rawView = searchParams.get("view");
  const view: ViewMode = rawView === "scripts" || rawView === "api-lab" || rawView === "base64" ? rawView : "flows";
  const studioMode = view === "scripts" ? "scripts" : "flows";
  const companies = clients.map((company) => ({ name: company.name, slug: company.slug }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-[18px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3">
        <Link
          href="/casos-de-teste"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-4 py-2 text-sm font-semibold text-[var(--tc-text,#0b1a3c)]"
        >
          <FiClipboard className="h-4 w-4" />
          Casos
        </Link>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = view === tab.view;
          const href = tab.view === "flows" ? "/automacoes/ui-studio" : `/automacoes/ui-studio?view=${tab.view}`;
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

      {view === "flows" || view === "scripts" ? (
        <AutomationStudio
          access={access}
          activeCompanySlug={activeClient?.slug ?? null}
          companies={companies}
          initialFlowId={searchParams.get("flow")}
          onOpenRealRunner={() => router.push("/automacoes/execucoes")}
          mode={studioMode}
        />
      ) : null}

      {view === "api-lab" ? (
        <AutomationApiLab activeCompanySlug={activeClient?.slug ?? null} companies={companies} />
      ) : null}

      {view === "base64" ? <Base64Studio /> : null}

      <AutomationGithubSender
        defaultTitle={activeClient?.name ? `[${activeClient.name}] Automação` : ""}
        defaultBody="Descreva o contexto da automação (script, request ou execução) a ser registrado."
        defaultLabels={["automation"]}
      />
    </div>
  );
}
