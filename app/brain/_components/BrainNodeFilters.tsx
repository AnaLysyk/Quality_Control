"use client";

import type { BrainGraphFilter } from "../_types/brain.types";

const FILTERS: Array<{ id: BrainGraphFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "access_requests", label: "Solicitacoes" },
  { id: "requesters", label: "Solicitantes" },
  { id: "profiles", label: "Perfis" },
  { id: "integrations", label: "Integracoes" },
  { id: "status", label: "Status" },
  { id: "logs", label: "Logs" },
  { id: "emails", label: "E-mails" },
  { id: "pending", label: "Pendencias" },
  { id: "orphans", label: "Orfaos" },
];

type BrainNodeFiltersProps = {
  value: BrainGraphFilter;
  onChange: (value: BrainGraphFilter) => void;
};

export function BrainNodeFilters({ value, onChange }: BrainNodeFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={() => onChange(filter.id)}
          className={`rounded-full border px-3.5 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
            value === filter.id
              ? "border-[#011848] bg-[#011848] text-white shadow-[0_12px_24px_rgba(1,24,72,0.18)] dark:border-white dark:bg-white dark:text-[#011848]"
              : "border-slate-200 bg-white text-slate-600 hover:border-[#ef0001]/30 hover:text-[#ef0001] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-rose-300 dark:hover:text-rose-200"
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
