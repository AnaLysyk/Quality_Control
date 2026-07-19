"use client";

import { useEffect, useMemo, useState } from "react";
import { FiBriefcase, FiChevronDown, FiChevronUp, FiClock, FiFolder, FiUser, FiX } from "react-icons/fi";

import UserAvatar from "@/components/UserAvatar";

type Person = {
  id: string;
  name: string;
  full_name?: string | null;
  email: string;
  avatar_url?: string | null;
  avatar_key?: string | null;
};

type Company = { id: string; name: string; company_name?: string | null; slug: string };
type Project = { id: string; name: string; slug: string; companyId: string };

type HistoryEntry = {
  id: string;
  action: string;
  actionLabel: string;
  createdAt: string;
  reason?: string | null;
  company?: Company | null;
  project?: Project | null;
  targetUser?: Person | null;
  previousLeader?: Person | null;
  actor?: Person | null;
  actorEmail?: string | null;
  entityLabel?: string | null;
};

type HistoryProfile = {
  key: "leader_tc" | "qa_tc" | "business_user";
  label: string;
  entries: HistoryEntry[];
};

type HistoryResponse = {
  profiles: HistoryProfile[];
  total: number;
  globalVisibility: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const personName = (person?: Person | null) => person?.full_name || person?.name || person?.email || "Usuário não localizado";
const companyName = (company?: Company | null) => company?.company_name || company?.name || "Empresa não informada";

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
  const [data, setData] = useState<HistoryResponse>({ profiles: [], total: 0, globalVisibility: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);

  const visibleProfiles = useMemo(
    () => data.profiles.filter((profile) => profile.entries.length > 0),
    [data.profiles],
  );

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
      const first = body.profiles?.find((profile: HistoryProfile) => profile.entries?.length > 0);
      setExpandedProfile(first?.key ?? null);
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
            <p className="text-[10px] font-black uppercase tracking-[0.22em]">Histórico por perfil</p>
            <h2 className="mt-1 text-xl font-black">Alterações de vínculo</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--rel-muted)" }}>
              {data.total} alteração{data.total === 1 ? "" : "ões"} registrada{data.total === 1 ? "" : "s"}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar histórico"><FiX /></button>
        </div>

        <div className="relationship-history-content">
          {loading ? <div className="relationship-history-empty"><FiClock /> Carregando histórico…</div> : null}
          {!loading && error ? <div className="relationship-history-empty">{error}</div> : null}
          {!loading && !error && visibleProfiles.length === 0 ? (
            <div className="relationship-history-empty"><FiClock /> Nenhuma alteração de vínculo registrada.</div>
          ) : null}

          {!loading && !error ? visibleProfiles.map((profile) => {
            const profileOpen = expandedProfile === profile.key;
            return (
              <section key={profile.key} className="relationship-history-company" data-open={profileOpen}>
                <button
                  type="button"
                  className="relationship-history-company-trigger"
                  onClick={() => setExpandedProfile(profileOpen ? null : profile.key)}
                >
                  <span className="relationship-history-company-icon"><FiUser /></span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-black">{profile.label}</span>
                    <span className="mt-1 block text-xs" style={{ color: "var(--rel-muted)" }}>
                      {profile.entries.length} alteração{profile.entries.length === 1 ? "" : "ões"}
                    </span>
                  </span>
                  {profileOpen ? <FiChevronUp /> : <FiChevronDown />}
                </button>

                {profileOpen ? (
                  <div className="relationship-history-company-entries">
                    {profile.entries.map((entry) => (
                      <article key={entry.id} className="relationship-history-entry">
                        <UserAvatar
                          src={entry.targetUser?.avatar_url || entry.targetUser?.avatar_key || null}
                          name={personName(entry.targetUser)}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black">{entry.actionLabel}</p>
                            <span className="relationship-role-badge">{profile.label}</span>
                          </div>

                          <p className="mt-2 text-sm font-bold">{personName(entry.targetUser)}</p>
                          {entry.targetUser?.email ? (
                            <p className="mt-1 flex items-center gap-2 text-xs" style={{ color: "var(--rel-muted)" }}>
                              <FiUser /> {entry.targetUser.email}
                            </p>
                          ) : null}

                          <div className="mt-2 grid gap-1 text-xs" style={{ color: "var(--rel-muted)" }}>
                            <p className="flex items-center gap-2"><FiBriefcase /> {companyName(entry.company)}</p>
                            {entry.project ? <p className="flex items-center gap-2"><FiFolder /> {entry.project.name}</p> : null}
                          </div>

                          {entry.previousLeader ? (
                            <p className="mt-2 text-xs" style={{ color: "var(--rel-muted)" }}>
                              Liderança anterior: <strong>{personName(entry.previousLeader)}</strong>
                            </p>
                          ) : null}

                          {entry.reason ? <p className="mt-2 text-xs">Motivo: {entry.reason}</p> : null}

                          <p className="mt-2 text-xs" style={{ color: "var(--rel-muted)" }}>
                            Alterado por: {entry.actor ? personName(entry.actor) : entry.actorEmail || "Sistema"}
                          </p>
                          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--rel-muted)" }}>
                            {formatDate(entry.createdAt)}
                          </p>
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
