"use client";

import { useEffect, useMemo, useState } from "react";
import { FiArrowRight, FiBriefcase, FiCheckCircle, FiClock, FiLink2, FiSearch, FiTrash2, FiUser, FiUsers, FiX } from "react-icons/fi";

type Company = { id: string; name: string; company_name?: string | null; slug: string };
type Project = { id: string; companyId: string; name: string; slug: string; status: string };
type PersonSummary = { id: string; name: string; full_name?: string | null; email: string; user?: string | null; role?: string | null; globalRole?: string | null; status: string; active: boolean };
type Assignment = {
  id: string;
  role: string;
  status: string;
  createdAt: string;
  removedAt?: string | null;
  removalReason?: string | null;
  company: Company;
  project: { id: string; name: string; slug: string };
};
type PersonDetail = PersonSummary & {
  memberships: Array<{ companyId: string; role?: string | null; allowedProjectIds: string[]; company: Company }>;
  projectTeamAssignments: Assignment[];
};

type SearchResponse = {
  companies: Company[];
  projects: Project[];
  people: PersonSummary[];
  permissions: { canManage: boolean };
};

const ROLE_LABEL: Record<string, string> = {
  leader_tc: "Líder TC",
  qa_tc: "Usuário TC",
  technical_support: "Suporte Técnico",
  company_admin: "Empresa",
  company: "Empresa",
  user: "Usuário",
};

function displayName(person: PersonSummary | PersonDetail) {
  return person.full_name || person.name || person.user || person.email;
}

export default function RelationshipManagementClient() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse>({ companies: [], projects: [], people: [], permissions: { canManage: false } });
  const [selectedPerson, setSelectedPerson] = useState<PersonDetail | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"leader_tc" | "qa_tc">("qa_tc");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Assignment | null>(null);
  const [removeReason, setRemoveReason] = useState("");

  const availableProjects = useMemo(
    () => data.projects.filter((project) => !selectedCompanyId || project.companyId === selectedCompanyId),
    [data.projects, selectedCompanyId],
  );

  async function loadSearch(nextQuery = query) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextQuery.trim()) params.set("q", nextQuery.trim());
      const response = await fetch(`/api/usuarios/vinculos?${params.toString()}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao carregar vínculos");
      setData(body);
      if (!selectedCompanyId && body.companies?.[0]?.id) setSelectedCompanyId(body.companies[0].id);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao carregar vínculos" });
    } finally {
      setLoading(false);
    }
  }

  async function loadPerson(personId: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/usuarios/vinculos?personId=${encodeURIComponent(personId)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao carregar pessoa");
      setSelectedPerson(body.person);
      const firstCompany = body.person.memberships?.[0]?.companyId || body.person.projectTeamAssignments?.[0]?.company?.id || data.companies[0]?.id || "";
      setSelectedCompanyId(firstCompany);
      setSelectedProjectId("");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao carregar pessoa" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSearch("");
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 5200);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (selectedProjectId && !availableProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId("");
    }
  }, [availableProjects, selectedProjectId]);

  async function createAssignment() {
    if (!selectedPerson || !selectedCompanyId || !selectedProjectId) {
      setMessage({ type: "error", text: "Selecione pessoa, empresa e projeto." });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/usuarios/vinculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedPerson.id, companyId: selectedCompanyId, projectId: selectedProjectId, role: selectedRole }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao criar vínculo");
      setMessage({ type: "success", text: `Brian confirmou: vínculo de ${ROLE_LABEL[selectedRole]} criado com sucesso.` });
      await loadPerson(selectedPerson.id);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao criar vínculo" });
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment() {
    if (!removeTarget || !removeReason.trim()) {
      setMessage({ type: "error", text: "Informe a justificativa da remoção." });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/usuarios/vinculos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: removeTarget.id, reason: removeReason.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao remover vínculo");
      setMessage({ type: "success", text: "Brian confirmou: vínculo removido e histórico preservado." });
      const personId = selectedPerson?.id;
      setRemoveTarget(null);
      setRemoveReason("");
      if (personId) await loadPerson(personId);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao remover vínculo" });
    } finally {
      setSaving(false);
    }
  }

  const activeAssignments = selectedPerson?.projectTeamAssignments.filter((item) => item.status === "active") ?? [];
  const historyAssignments = selectedPerson?.projectTeamAssignments.filter((item) => item.status !== "active") ?? [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,.10),transparent_32%),linear-gradient(180deg,#f8fafc,#ffffff)] px-4 py-6 text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.10),transparent_30%),linear-gradient(180deg,#020617,#07111f)] dark:text-white sm:px-6 lg:px-8">
      {message ? (
        <div className={`fixed right-5 top-5 z-[100] flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${message.type === "success" ? "border-emerald-300/50 bg-emerald-50/95 text-emerald-950 dark:border-emerald-300/20 dark:bg-emerald-950/90 dark:text-emerald-50" : "border-rose-300/50 bg-rose-50/95 text-rose-950 dark:border-rose-300/20 dark:bg-rose-950/90 dark:text-rose-50"}`}>
          {message.type === "success" ? <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <FiX className="mt-0.5 h-5 w-5 shrink-0" />}
          <p className="text-sm font-semibold">{message.text}</p>
        </div>
      ) : null}

      <section className="mx-auto max-w-[1500px]">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700/70 dark:text-cyan-200/60">Brian · contexto seguro</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Gestão de Vínculos</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Busque uma pessoa, consulte seus contextos e gerencie vínculos de empresa e projeto sem apagar o histórico.</p>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-cyan-200/70 bg-white/70 px-4 py-2 text-xs font-bold text-cyan-800 shadow-sm backdrop-blur-xl dark:border-cyan-100/15 dark:bg-white/[0.04] dark:text-cyan-100">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.9)]" />
            Permissões verificadas no backend
          </div>
        </header>

        <div className="relative mb-7 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/75 p-3 shadow-[0_24px_80px_rgba(15,23,42,.08)] backdrop-blur-2xl dark:border-cyan-100/10 dark:bg-white/[0.035] dark:shadow-[0_28px_90px_rgba(0,0,0,.35)]">
          <span className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent" />
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); loadSearch(query); }}>
            <div className="flex min-h-14 flex-1 items-center gap-3 rounded-[1.4rem] bg-slate-100/70 px-5 dark:bg-slate-950/55">
              <FiSearch className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busque uma pessoa, e-mail, login ou empresa" className="h-14 w-full bg-transparent text-base font-semibold outline-none placeholder:text-slate-400" />
            </div>
            <button type="submit" disabled={loading || query.trim().length < 2} className="min-h-14 rounded-[1.4rem] bg-slate-950 px-7 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200">
              {loading ? "Buscando…" : "Buscar"}
            </button>
          </form>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)]">
          <section className="min-h-[620px] overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 shadow-[0_20px_70px_rgba(15,23,42,.07)] backdrop-blur-2xl dark:border-white/8 dark:bg-white/[0.035]">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-5 dark:border-white/8">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Resultados</p>
                <h2 className="mt-1 text-lg font-black">Pessoas encontradas</h2>
              </div>
              <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-700 dark:text-cyan-200">{data.people.length}</span>
            </div>

            <div className="divide-y divide-slate-200/70 dark:divide-white/[0.07]">
              {!loading && query.trim().length < 2 ? (
                <div className="flex min-h-[480px] flex-col items-center justify-center px-8 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] border border-cyan-200/70 bg-cyan-50 text-cyan-700 shadow-[0_20px_60px_rgba(14,165,233,.15)] dark:border-cyan-100/15 dark:bg-cyan-300/10 dark:text-cyan-100"><FiUsers className="h-8 w-8" /></div>
                  <h3 className="mt-5 text-xl font-black">Comece pela busca</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">Digite pelo menos dois caracteres. O sistema mostrará somente pessoas dentro do seu contexto autorizado.</p>
                </div>
              ) : null}

              {!loading && query.trim().length >= 2 && data.people.length === 0 ? (
                <div className="px-8 py-20 text-center text-sm font-semibold text-slate-500">Nenhuma pessoa encontrada no contexto autorizado.</div>
              ) : null}

              {data.people.map((person) => (
                <button key={person.id} type="button" onClick={() => loadPerson(person.id)} className={`group flex w-full items-center gap-4 px-6 py-5 text-left transition hover:bg-cyan-500/[0.05] ${selectedPerson?.id === person.id ? "bg-cyan-500/[0.08]" : ""}`}>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300"><FiUser className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black">{displayName(person)}</p>
                    <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{person.email}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600 dark:bg-white/8 dark:text-slate-300">{ROLE_LABEL[String(person.role)] || person.globalRole || person.role || "Perfil não definido"}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${person.active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" : "bg-rose-500/10 text-rose-700 dark:text-rose-200"}`}>{person.active ? "Ativo" : "Inativo"}</span>
                    </div>
                  </div>
                  <FiArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-cyan-500" />
                </button>
              ))}
            </div>
          </section>

          <aside className="min-h-[620px] overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/80 shadow-[0_22px_80px_rgba(15,23,42,.08)] backdrop-blur-2xl dark:border-cyan-100/10 dark:bg-[linear-gradient(145deg,rgba(3,10,24,.94),rgba(7,20,38,.90))]">
            {!selectedPerson ? (
              <div className="flex min-h-[620px] flex-col items-center justify-center px-8 text-center">
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-400/10 text-cyan-600 shadow-[0_0_70px_rgba(34,211,238,.18)] dark:text-cyan-200">
                  <span className="absolute inset-3 rounded-full border border-cyan-400/20" />
                  <FiLink2 className="h-9 w-9" />
                </div>
                <h3 className="mt-6 text-xl font-black">Brian está pronto</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">Selecione uma pessoa para visualizar empresas, projetos, liderança, status e histórico.</p>
              </div>
            ) : (
              <div>
                <div className="border-b border-slate-200/70 px-6 py-6 dark:border-white/8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-200"><FiUser className="h-6 w-6" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700/60 dark:text-cyan-200/50">Pessoa selecionada</p>
                      <h2 className="mt-1 truncate text-xl font-black">{displayName(selectedPerson)}</h2>
                      <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{selectedPerson.email}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedPerson(null)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"><FiX /></button>
                  </div>
                </div>

                <div className="max-h-[calc(100vh-240px)] overflow-y-auto px-6 py-5">
                  {data.permissions.canManage ? (
                    <section className="rounded-[1.5rem] border border-cyan-200/70 bg-cyan-50/60 p-4 dark:border-cyan-100/10 dark:bg-cyan-300/[0.05]">
                      <div className="flex items-center gap-2"><FiLink2 className="text-cyan-600 dark:text-cyan-200" /><h3 className="font-black">Criar vínculo</h3></div>
                      <div className="mt-4 grid gap-3">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Empresa
                          <select value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950 dark:text-white">
                            <option value="">Selecione</option>
                            {data.companies.map((company) => <option key={company.id} value={company.id}>{company.company_name || company.name}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Projeto
                          <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950 dark:text-white">
                            <option value="">Selecione</option>
                            {availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                          </select>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setSelectedRole("leader_tc")} data-active={selectedRole === "leader_tc"} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-600 data-[active=true]:border-cyan-500 data-[active=true]:bg-cyan-500/10 data-[active=true]:text-cyan-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:data-[active=true]:text-cyan-100">Líder TC</button>
                          <button type="button" onClick={() => setSelectedRole("qa_tc")} data-active={selectedRole === "qa_tc"} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-600 data-[active=true]:border-cyan-500 data-[active=true]:bg-cyan-500/10 data-[active=true]:text-cyan-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:data-[active=true]:text-cyan-100">Usuário TC</button>
                        </div>
                        <button type="button" onClick={createAssignment} disabled={saving || !selectedProjectId} className="mt-1 h-11 rounded-xl bg-slate-950 text-sm font-black text-white transition hover:bg-cyan-700 disabled:opacity-40 dark:bg-cyan-300 dark:text-slate-950">{saving ? "Salvando…" : "Confirmar vínculo"}</button>
                      </div>
                    </section>
                  ) : null}

                  <section className="mt-5">
                    <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-black"><FiBriefcase className="text-cyan-600 dark:text-cyan-200" /> Vínculos ativos</h3><span className="text-xs font-black text-slate-400">{activeAssignments.length}</span></div>
                    <div className="mt-3 space-y-3">
                      {activeAssignments.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400 dark:border-white/10">Nenhum vínculo ativo.</p> : null}
                      {activeAssignments.map((assignment) => (
                        <article key={assignment.id} className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/8 dark:bg-white/[0.035]">
                          <div className="flex items-start justify-between gap-3">
                            <div><p className="font-black">{assignment.project.name}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{assignment.company.company_name || assignment.company.name}</p><span className="mt-3 inline-flex rounded-full bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-700 dark:text-cyan-200">{ROLE_LABEL[assignment.role] || assignment.role}</span></div>
                            {data.permissions.canManage ? <button type="button" onClick={() => setRemoveTarget(assignment)} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-600" title="Remover vínculo"><FiTrash2 className="h-4 w-4" /></button> : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="mt-6">
                    <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-black"><FiClock className="text-violet-600 dark:text-violet-200" /> Histórico</h3><span className="text-xs font-black text-slate-400">{historyAssignments.length}</span></div>
                    <div className="mt-3 space-y-3">
                      {historyAssignments.length === 0 ? <p className="text-sm text-slate-400">Nenhum vínculo removido.</p> : null}
                      {historyAssignments.map((assignment) => (
                        <article key={assignment.id} className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 opacity-80 dark:border-white/8 dark:bg-white/[0.025]">
                          <p className="font-bold">{assignment.project.name}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{ROLE_LABEL[assignment.role] || assignment.role} · removido em {assignment.removedAt ? new Date(assignment.removedAt).toLocaleString("pt-BR") : "data não informada"}</p>
                          {assignment.removalReason ? <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">Motivo: {assignment.removalReason}</p> : null}
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      {removeTarget ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/15 bg-white p-6 shadow-2xl dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-rose-500">Remoção segura</p><h2 className="mt-2 text-xl font-black">Remover vínculo</h2><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">O histórico será preservado e o usuário receberá uma notificação.</p></div><button type="button" onClick={() => { setRemoveTarget(null); setRemoveReason(""); }} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10"><FiX /></button></div>
            <div className="mt-5 rounded-2xl bg-slate-100 p-4 dark:bg-white/[0.05]"><p className="font-black">{removeTarget.project.name}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{ROLE_LABEL[removeTarget.role] || removeTarget.role}</p></div>
            <label className="mt-5 block text-xs font-black uppercase tracking-wide text-slate-500">Justificativa<textarea value={removeReason} onChange={(event) => setRemoveReason(event.target.value)} rows={4} placeholder="Informe o motivo da remoção" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none focus:border-rose-400 dark:border-white/10 dark:bg-slate-900 dark:text-white" /></label>
            <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => { setRemoveTarget(null); setRemoveReason(""); }} className="h-11 rounded-xl px-5 text-sm font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">Cancelar</button><button type="button" onClick={removeAssignment} disabled={saving || !removeReason.trim()} className="h-11 rounded-xl bg-rose-600 px-5 text-sm font-black text-white disabled:opacity-40">{saving ? "Removendo…" : "Confirmar remoção"}</button></div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
