"use client";

import { useRef, useState } from "react";
import { FiChevronDown, FiFolder, FiPlus } from "react-icons/fi";
import { useProjectContext } from "@/lib/core/project/ProjectContext";
import styles from "./ProjectSelector.module.css";

type Props = {
  collapsed?: boolean;
};

export default function ProjectSelector({ collapsed = false }: Props) {
  const { projects, activeProject, loading, setActiveProject } = useProjectContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (loading) {
    return collapsed ? null : (
      <div className="mx-3 mb-2 h-8 animate-pulse rounded-md bg-white/10" />
    );
  }

  if (projects.length === 0) {
    return collapsed ? null : (
      <div className="mx-3 mb-2 flex items-center gap-1.5 rounded-md border border-dashed border-white/20 px-2 py-1.5 text-[11px] text-white/40">
        <FiFolder className="shrink-0" size={12} />
        <span>Sem projetos</span>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="mx-auto mb-1 flex justify-center">
        <button
          title={activeProject?.name ?? "Projeto"}
          onClick={() => setOpen((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 transition hover:bg-white/20"
        >
          <FiFolder size={14} className="text-white/80" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative mx-3 mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md bg-white/10 px-2.5 py-1.5 text-left transition hover:bg-white/20"
      >
        <span className={styles.dot} />
        <span className="flex-1 truncate text-[11px] font-medium text-white/90">
          {activeProject?.name ?? "Selecionar projeto"}
        </span>
        <FiChevronDown
          size={12}
          className={`shrink-0 text-white/50 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-md border border-white/15 bg-[#0a1e4a] py-1 shadow-xl">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => { setActiveProject(p.slug); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition hover:bg-white/10 ${
                activeProject?.id === p.id ? "text-white" : "text-white/60"
              }`}
            >
              <span className={activeProject?.id === p.id ? styles.dot : styles.dotMuted} />
              <span className="truncate">{p.name}</span>
              {activeProject?.id === p.id && (
                <span className="ml-auto text-[10px] text-white/30">ativo</span>
              )}
            </button>
          ))}
          <div className="mx-2 my-1 border-t border-white/10" />
          <button
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-white/40 transition hover:bg-white/10 hover:text-white/70"
          >
            <FiPlus size={11} />
            <span>Novo projeto</span>
          </button>
        </div>
      )}
    </div>
  );
}
