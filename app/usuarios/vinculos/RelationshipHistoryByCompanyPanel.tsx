"use client";

import { useEffect, useMemo, useState } from "react";
import { FiBriefcase, FiChevronDown, FiChevronUp, FiClock, FiUser, FiX } from "react-icons/fi";

import UserAvatar from "@/components/UserAvatar";

type HistoryEntry = {
  id: string;
  role: string;
  createdAt: string;
  removedAt?: string | null;
  removalReason?: string | null;
  project: { id: string; name: string; slug: string };
  user: {
    id: string;
    name: string;
    full_name?: string | null;
    email: string;
    avatar_url?: string | null;
    avatar_key?: string | null;
  };
};

type HistoryCompany = {
  id: string;
  name: string;
  slug: string;
  entries: HistoryEntry[];
};

type HistoryResponse = {
  companies: HistoryCompany[];
  total: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const personName = (entry: HistoryEntry) => entry.user.full_name || entry.user.name || entry.user.email;
const roleLabel = (role: string) => role === "leader_tc" ? "Líder TC" : role === "qa_tc" ? "Usuário TC" : role;

function formatDate(value?: string | null) {
  if (!value) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function RelationshipHistoryByCompanyPanel({ open, onClose }: Props) {
  const [data, setData] = useState<HistoryResponse>({ companies: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);

  const hasEntries = useMemo(() => data.total > 0, [data.total]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/usuarios/vinculos/history", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao carregar histórico");
      setData(body);
      setExpandedCompanyId(body.companies?.[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar histórico");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-slate-950/35 backdrop-blur-sm" onClick={onClose}>
      <aside className="relationship-history-panel relationship-history-by-company" onClick={(event) => event.stopPropagation()}>
        <div className="relationship-history-heading">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em]">Histórico por empresa</p>
            <h2 className="mt-1 text-xl font-black">Alterações de vínculo</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--rel-muted)" }}>{data.total} alteração{data.total === 1 ? "" : "ões"} registrada{data.total === 1 ? "" : "s"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar histórico"><FiX /></button>
        </div>

        <div className="relationship-history-content">
          {loading ? <div className="relationship-history-empty"><FiClock /> Carregando histórico…</div> : null}
          {!loading && error ? <div className="relationship-history-empty">{error}</div> : null}
          {!loading && !error && !hasEntries ? <div className="relationship-history-empty"><FiClock /> Nenhuma alteração de vínculo registrada.</div> : null}

          {!loading && !error ? data.companies.map((company) => {
            const openCompany = expandedCompanyId === company.id;
            return (
              <section key={company.id} className="relationship-history-company" data-open={openCompany}>
                <button type="button" className="relationship-history-company-trigger" onClick={() => setExpandedCompanyId(openCompany ? null : company.id)}>
                  <span className="relationship-history-company-icon"><FiBriefcase /></span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-black">{company.name}</span>
                    <span className="mt-1 block text-xs" style={{ color: "var(--rel-muted)" }}>{company.entries.length} alteração{company.entries.length === 1 ? "" : "ões"}</span>
                  </span>
                  {openCompany ? <FiChevronUp /> : <FiChevronDown />}
                </button>

                {openCompany ? (
                  <div className="relationship-history-company-entries">
                    {company.entries.map((entry) => (
                      <article key={entry.id} className="relationship-history-entry">
                        <UserAvatar src={entry.user.avatar_url || entry.user.avatar_key || null} name={personName(entry)} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black">{personName(entry)}</p>
                            <span className="relationship-role-badge">{roleLabel(entry.role)}</span>
                          </div>
                          <p className="mt-1 flex items-center gap-2 text-xs" style={{ color: "var(--rel-muted)" }}><FiUser /> {entry.user.email}</p>
                          <p className="mt-1 text-xs font-bold">{entry.project.name}</p>
                          <p className="mt-2 text-xs" style={{ color: "var(--rel-muted)" }}>{entry.removalReason || "Sem justificativa registrada"}</p>
                          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--rel-muted)" }}>{formatDate(entry.removedAt)}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          }) : null}
        </div>
      </aside>
    </div>
  );
}
