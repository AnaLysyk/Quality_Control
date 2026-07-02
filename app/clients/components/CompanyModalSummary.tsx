"use client";

import { FiCheckCircle, FiCloudLightning, FiLink2, FiUser, FiZap } from "react-icons/fi";

export type CompanyModalSummaryProps = {
  mode: "create" | "view" | "edit";
  isEditing: boolean;
  syncWithMyProfile?: boolean;
  profileSyncDetected?: boolean;
  name?: string | null;
  adminEmail?: string | null;
  companyUsername?: string | null;
  qaseTokenConfigured?: boolean;
  selectedQaseProjectsCount?: number;
  primaryQaseProjectCode?: string | null;
  notificationsFanoutEnabled?: boolean;
};

function text(value?: string | null, fallback = "NÃ£o informado") {
  const normalized = value?.trim();
  return normalized || fallback;
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/18 bg-white/10 px-2.5 py-1 text-[11px] font-black text-white/88">
      <span className="text-white/55">{label}:</span> {value}
    </span>
  );
}

export function CompanyModalSummary({
  mode,
  isEditing,
  syncWithMyProfile,
  profileSyncDetected,
  name,
  adminEmail,
  companyUsername,
  qaseTokenConfigured,
  selectedQaseProjectsCount = 0,
  primaryQaseProjectCode,
  notificationsFanoutEnabled,
}: CompanyModalSummaryProps) {
  const modeLabel = mode === "create" ? "CriaÃ§Ã£o" : isEditing ? "EdiÃ§Ã£o" : "VisualizaÃ§Ã£o";
  const qaseLabel = qaseTokenConfigured
    ? selectedQaseProjectsCount > 0
      ? `${selectedQaseProjectsCount} projeto${selectedQaseProjectsCount === 1 ? "" : "s"}`
      : "Token informado"
    : "Manual";

  return (
    <div className="mt-4 rounded-2xl border border-white/14 bg-white/8 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/62">
            <FiUser className="h-4 w-4" /> Resumo operacional
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SummaryPill label="Modo" value={modeLabel} />
            <SummaryPill label="Empresa" value={text(name, "Nova empresa")} />
            <SummaryPill label="Admin" value={text(adminEmail)} />
            <SummaryPill label="UsuÃ¡rio" value={text(companyUsername, "A gerar")} />
            <SummaryPill label="Fan-out" value={notificationsFanoutEnabled ? "Ativo" : "Inativo"} />
          </div>
        </div>

        <div className="rounded-xl border border-white/12 bg-slate-950/18 p-3">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/62">
            <FiCloudLightning className="h-4 w-4" /> Qase e aplicaÃ§Ãµes
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SummaryPill label="IntegraÃ§Ã£o" value={qaseLabel} />
            <SummaryPill label="Principal" value={text(primaryQaseProjectCode, "Sem projeto principal")} />
          </div>
          {syncWithMyProfile ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-sky-200/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold leading-5 text-sky-50">
              <FiLink2 className="mt-0.5 h-4 w-4 shrink-0" />
              {profileSyncDetected
                ? "Dados carregados do Meu Perfil da empresa. Ao salvar, o perfil institucional tambÃ©m serÃ¡ atualizado."
                : "Fluxo preparado para sincronizar com Meu Perfil da empresa quando houver dados disponÃ­veis."}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export type CompanyQaseApplicationsSummaryProps = {
  selectedProjects: Array<{ code: string; title?: string | null; status?: "unknown" | "valid" | "invalid" }>;
  primaryProjectCode?: string | null;
};

export function CompanyQaseApplicationsSummary({ selectedProjects, primaryProjectCode }: CompanyQaseApplicationsSummaryProps) {
  if (!selectedProjects.length) {
    return (
      <div className="rounded-xl border border-dashed border-sky-300 bg-sky-50 px-4 py-4 text-sm font-semibold leading-6 text-sky-900 dark:border-sky-700/55 dark:bg-sky-950/30 dark:text-sky-100">
        Nenhuma aplicaÃ§Ã£o Qase selecionada. A empresa serÃ¡ criada em modo manual atÃ© selecionar projetos.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] dark:border-sky-700/45 dark:bg-slate-950/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-slate-50">
            <FiZap className="h-4 w-4 text-sky-500" /> AplicaÃ§Ãµes que serÃ£o criadas
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
            Cada projeto Qase selecionado vira uma aplicaÃ§Ã£o independente da empresa.
          </p>
        </div>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black text-sky-700 dark:border-sky-700/55 dark:bg-sky-950/50 dark:text-sky-100">
          {selectedProjects.length} aplicaÃ§Ã£o{selectedProjects.length === 1 ? "" : "Ãµes"}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {selectedProjects.map((project) => {
          const isPrimary = primaryProjectCode === project.code;
          return (
            <div key={project.code} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950 dark:text-slate-50">{project.title || project.code}</p>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">{project.code}</p>
                </div>
                {isPrimary ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100">
                    <FiCheckCircle className="h-3 w-3" /> Principal
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

