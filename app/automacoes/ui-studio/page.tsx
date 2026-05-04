"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FiClipboard, FiCode, FiGitBranch } from "react-icons/fi";

import AutomationStudio from "../AutomationStudio";
import { useAutomationModuleContext } from "../_components/AutomationModuleContext";

export default function AutomacoesUiStudioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { access, clients, activeClient } = useAutomationModuleContext();
  const mode = searchParams.get("view") === "scripts" ? "scripts" : "flows";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-[18px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-3">
        <Link
          href="/automacoes/casos"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
        >
          <FiClipboard className="h-4 w-4" />
          Casos
        </Link>
        <Link
          href="/automacoes/ui-studio"
          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${
            mode === "flows" ? "border-(--tc-accent,#ef0001) bg-[#fff5f5] text-(--tc-accent,#ef0001)" : "border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) text-(--tc-text,#0b1a3c)"
          }`}
        >
          <FiGitBranch className="h-4 w-4" />
          Fluxo
        </Link>
        <Link
          href="/automacoes/ui-studio?view=scripts"
          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${
            mode === "scripts" ? "border-(--tc-accent,#ef0001) bg-[#fff5f5] text-(--tc-accent,#ef0001)" : "border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) text-(--tc-text,#0b1a3c)"
          }`}
        >
          <FiCode className="h-4 w-4" />
          Script
        </Link>
      </div>

      <AutomationStudio
        access={access}
        activeCompanySlug={activeClient?.slug ?? null}
        companies={clients.map((company) => ({ name: company.name, slug: company.slug }))}
        initialFlowId={searchParams.get("flow")}
        onOpenRealRunner={() => router.push("/automacoes/execucoes")}
        mode={mode}
      />
    </div>
  );
}

