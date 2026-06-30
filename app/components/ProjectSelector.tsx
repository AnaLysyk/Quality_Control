"use client";

import { useState } from "react";
import { FiBriefcase, FiChevronDown, FiFolder, FiPlus } from "react-icons/fi";
import { useClientContext } from "@/context/ClientContext";
import { useProjectContext } from "@/lib/core/project/ProjectContext";
import styles from "./ProjectSelector.module.css";

type Props = {
  collapsed?: boolean;
  showCompanySelector?: boolean;
};

export default function ProjectSelector({ collapsed = false, showCompanySelector = true }: Props) {
  const {
    clients,
    activeClient,
    activeClientSlug,
    loading: clientLoading,
    setActiveClientSlug,
  } = useClientContext();

  const {
    projects,
    activeProject,
    loading: projectLoading,
    setActiveProject,
  } = useProjectContext();

  const [companyOpen, setCompanyOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  const hasCompanies = clients.length > 0;
  const hasMultipleCompanies = clients.length > 1;
  const hasActiveCompany = Boolean(activeClientSlug);
  const hasProjects = projects.length > 0;

  if (collapsed) {
    const label = activeClient?.name
      ? activeProject?.name
        ? `${activeClient.name} / ${activeProject.name}`
        : activeClient.name
      : "Selecionar empresa e projeto";

    return (
      <div className="mx-auto mb-1 flex justify-center">
        <button
          type="button"
          title={label}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 transition hover:bg-white/20"
        >
          <FiFolder size={14} className="text-white/80" />
        </button>
      </div>
    );
  }

  if (clientLoading) {
    return <div className="mx-3 mb-2 h-16 animate-pulse rounded-xl bg-white/10" />;
  }

  if (!hasCompanies) {
    return (
      <div className="mx-3 mb-2 rounded-xl border border-dashed border-white/20 px-3 py-2 text-[11px] text-white/45">
        <div className="flex items-center gap-2">
          <FiBriefcase className="shrink-0" size={13} />
          <span>Nenhuma empresa vinculada</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-3 mb-2 space-y-2">
      {showCompanySelector ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (!hasMultipleCompanies) return;
              setCompanyOpen((value) => !value);
              setProjectOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-2.5 py-2 text-left transition hover:bg-white/15"
            data-testid="sidebar-company-selector"
          >
            <FiBriefcase size={13} className="shrink-0 text-white/70" />

            <span className="min-w-0 flex-1">
              <span className="block text-[9px] font-black uppercase tracking-[0.22em] text-white/35">
                Empresa
              </span>
              <span className="block truncate text-[11px] font-semibold text-white/90">
                {activeClient?.name ?? "Selecionar empresa"}
              </span>
            </span>

            {hasMultipleCompanies ? (
              <FiChevronDown
                size={12}
                className={`shrink-0 text-white/50 transition-transform ${companyOpen ? "rotate-180" : ""}`}
              />
            ) : null}
          </button>

          {companyOpen ? (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/15 bg-[#0a1e4a] py-1 shadow-xl">
              {clients.map((company) => {
                const active = company.slug === activeClientSlug;

                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => {
                      setActiveClientSlug(company.slug);
                      setCompanyOpen(false);
                      setProjectOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] transition hover:bg-white/10 ${
                      active ? "text-white" : "text-white/65"
                    }`}
                    data-testid={`sidebar-company-option-${company.slug}`}
                  >
                    <span className={active ? styles.dot : styles.dotMuted} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{company.name}</span>
                      <span className="block truncate text-[10px] text-white/35">/{company.slug}</span>
                    </span>
                    {active ? <span className="text-[10px] text-white/35">ativa</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="relative">
        <button
          type="button"
          disabled={!hasActiveCompany || projectLoading || !hasProjects}
          onClick={() => {
            if (!hasActiveCompany || projectLoading || !hasProjects) return;
            setProjectOpen((value) => !value);
            setCompanyOpen(false);
          }}
          className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-2.5 py-2 text-left transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="sidebar-project-selector"
        >
          <FiFolder size={13} className="shrink-0 text-white/70" />

          <span className="min-w-0 flex-1">
            <span className="block text-[9px] font-black uppercase tracking-[0.22em] text-white/35">
              Projeto
            </span>
            <span className="block truncate text-[11px] font-semibold text-white/90">
              {!hasActiveCompany
                ? "Escolha uma empresa"
                : projectLoading
                  ? "Carregando projetos..."
                  : activeProject?.name ?? (hasProjects ? "Selecionar projeto" : "Sem projetos")}
            </span>
          </span>

          {hasProjects ? (
            <FiChevronDown
              size={12}
              className={`shrink-0 text-white/50 transition-transform ${projectOpen ? "rotate-180" : ""}`}
            />
          ) : null}
        </button>

        {projectOpen ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/15 bg-[#0a1e4a] py-1 shadow-xl">
            {projects.map((project) => {
              const active = activeProject?.id === project.id;

              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => {
                    setActiveProject(project.slug);
                    setProjectOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] transition hover:bg-white/10 ${
                    active ? "text-white" : "text-white/65"
                  }`}
                  data-testid={`sidebar-project-option-${project.slug}`}
                >
                  <span className={active ? styles.dot : styles.dotMuted} />
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  {active ? <span className="text-[10px] text-white/35">ativo</span> : null}
                </button>
              );
            })}

            <div className="mx-2 my-1 border-t border-white/10" />

            <button
              type="button"
              onClick={() => setProjectOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-white/45 transition hover:bg-white/10 hover:text-white/75"
              data-testid="sidebar-project-create"
            >
              <FiPlus size={11} />
              <span>Novo projeto</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
