"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiArrowRight,
  FiBriefcase,
  FiBuilding,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiFolder,
  FiLink2,
  FiSearch,
  FiTrash2,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi";

type Company = { id: string; name: string; company_name?: string | null; slug: string; status?: string };
type Project = { id: string; companyId: string; name: string; slug: string; status: string; company?: Company };
type Assignment = {
  id: string;
  role: string;
  status: string;
  createdAt?: string;
  removedAt?: string | null;
  removalReason?: string | null;
  company: Company;
  project: { id: string; name: string; slug: string };
  user?: { id: string; name: string; full_name?: string | null; email: string };
};
type PersonSummary = {
  id: string;
  name: string;
  full_name?: string | null;
  email: string;
  user?: string | null;
  role?: string | null;
  globalRole?: string | null;
  status: string;
  active: boolean;
  memberships?: Array<{ companyId: string; role?: string | null; company: Company }>;
  projectTeamAssignments?: Array<Assignment & { companyId?: string; projectId?: string }>;
};
type PersonDetail = PersonSummary & {
  memberships: Array<{ companyId: string; role?: string | null; allowedProjectIds: string[]; company: Company }>;
  projectTeamAssignments: Assignment[];
};
type SearchMode = "all" | "people" | "companies" | "projects" | "profiles";
type SelectedEntity =
  | { kind: "person"; id: string }
  | { kind: "company"; id: string }
  | { kind: "project"; id: string }
  | { kind: "profile"; id: string }
  | null;

type UniversalSearchResponse = {
  companies: Company[];
  projects: Project[];
  people: PersonSummary[];
  assignments: Assignment[];
  profiles: Array<{ role: string; count: number }>;
  permissions: { canCreate: boolean; canEdit: boolean; canDelete: boolean };
};
type BaseResponse = {
  companies: Company[];
  projects: Project[];
  people: PersonSummary[];
  permissions: { canManage: boolean };
};

const EMPTY_SEARCH: UniversalSearchResponse = {
  companies: [],
  projects: [],
  people: [],
  assignments: [],
  profiles: [],
  permissions: { canCreate: false, canEdit: false, canDelete: false },
};

const ROLE_LABEL: Record<string, string> = {
  leader_tc: "Líder TC",
  qa_tc: "Usuário TC",
  testing_company_user: "Usuário TC",
  technical_support: "Suporte Técnico",
  support: "Suporte Técnico",
  company_admin: "Empresa",
  empresa: "Empresa",
  company: "Empresa",
  company_user: "Usuário empresarial",
  user: "Usuário empresarial",
};

function displayName(person: PersonSummary | PersonDetail) {
  return person.full_name || person.name || person.user || person.email;
}

function roleLabel(role?: string | null) {
  return ROLE_LABEL[String(role ?? "user")] ?? String(role ?? "Usuário").replaceAll("_", " ");
}

function companyName(company?: Company | null) {
  return company?.company_name || company?.name || "Empresa";
}

function BRAINVisual({ busy }: { busy: boolean }) {
  return (
    <div className="relative mx-auto h-[190px] w-[190px] sm:h-[230px] sm:w-[230px]">
      <div className="brain-orb-wrap !h-full !w-full" aria-label="BRAIN visual" />
      <div className={`pointer-events-none absolute inset-0 rounded-full ${busy ? "animate-pulse" : ""}`} />
      <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-[0.42em] text-slate-500 dark:text-slate-300">
        BRAIN
      </span>
    </div>
  );
}

export default function RelationshipManagementClient() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("all");
  const [searchData, setSearchData] = useState<UniversalSearchResponse>(EMPTY_SEARCH);
  const [baseData, setBaseData] = useState<BaseResponse>({ companies: [], projects: [], people: [], permissions: { canManage: false } });
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);
  const [selectedPerson, setSelectedPerson] = useState<PersonDetail | null>(null);
  const [expandedKey, setExpandedKey] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"leader_tc" | "qa_tc">("qa_tc");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Assignment | null>(null);
  const [removeReason, setRemoveReason] = useState("");

  const availableProjects = useMemo(
    () => baseData.projects.filter((project) => !selectedCompanyId || project.companyId === selectedCompanyId),
    [baseData.projects, selectedCompanyId],
  );

  const activeAssignments = selectedPerson?.projectTeamAssignments.filter((item) => item.status === "active") ?? [];
  const historyAssignments = selectedPerson?.projectTeamAssignments.filter((item) => item.status !== "active") ?? [];

  const selectedCompany = selectedEntity?.kind === "company"
    ? searchData.companies.find((item) => item.id === selectedEntity.id) ?? null
    : null;
  const selectedProject = selectedEntity?.kind === "project"
    ? searchData.projects.find((item) => item.id === selectedEntity.id) ?? null
    : null;
  const selectedProfile = selectedEntity?.kind === "profile" ? selectedEntity.id : null;

  const selectedCompanyAssignments = useMemo(
    () => selectedCompany ? searchData.assignments.filter((item) => item.company.id === selectedCompany.id) : [],
    [searchData.assignments, selectedCompany],
  );
  const selectedProjectAssignments = useMemo(
    () => selectedProject ? searchData.assignments.filter((item) => item.project.id === selectedProject.id) : [],
    [searchData.assignments, selectedProject],
  );
  const selectedProfilePeople = useMemo(
    () => selectedProfile
      ? searchData.people.filter((person) => String(person.globalRole ?? person.role ?? "user") === selectedProfile)
      : [],
    [searchData.people, selectedProfile],
  );

  useEffect(() => {
    void loadBase();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (selectedProjectId && !availableProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId("");
    }
  }, [availableProjects, selectedProjectId]);

  async function loadBase() {
    try {
      const response = await fetch("/api/usuarios/vinculos", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao carregar contextos");
      setBaseData(body);
      if (body.companies?.[0]?.id) setSelectedCompanyId(body.companies[0].id);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao carregar contextos" });
    }
  }

  async function runSearch() {
    if (query.trim().length < 2) {
      setMessage({ type: "error", text: "Digite pelo menos dois caracteres." });
      return;
    }
    setLoading(true);
    setSelectedEntity(null);
    setSelectedPerson(null);
    setExpandedKey("");
    try {
      const params = new URLSearchParams({ q: query.trim(), mode });
      const response = await fetch(`/api/usuarios/vinculos/search?${params.toString()}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao pesquisar vínculos");
      setSearchData(body);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao pesquisar vínculos" });
    } finally {
      setLoading(false);
    }
  }

  async function loadPerson(personId: string) {
    setLoading(true);
    setSelectedEntity({ kind: "person", id: personId });
    setExpandedKey(`person:${personId}`);
    try {
      const response = await fetch(`/api/usuarios/vinculos?personId=${encodeURIComponent(personId)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao carregar pessoa");
      setSelectedPerson(body.person);
      const firstCompany = body.person.memberships?.[0]?.companyId || body.person.projectTeamAssignments?.[0]?.company?.id || baseData.companies[0]?.id || "";
      setSelectedCompanyId(firstCompany);
      setSelectedProjectId("");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao carregar pessoa" });
    } finally {
      setLoading(false);
    }
  }

  function selectSimple(kind: "company" | "project" | "profile", id: string) {
    const key = `${kind}:${id}`;
    setExpandedKey((current) => (current === key ? "" : key));
    setSelectedEntity({ kind, id });
    setSelectedPerson(null);
  }

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
      setMessage({ type: "success", text: `BRAIN confirmou: vínculo de ${ROLE_LABEL[selectedRole]} criado com sucesso.` });
      await loadPerson(selectedPerson.id);
      await runSearch();
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
      setMessage({ type: "success", text: "BRAIN confirmou: vínculo removido e histórico preservado." });
      const personId = selectedPerson?.id;
      setRemoveTarget(null);
      setRemoveReason("");
      if (personId) await loadPerson(personId);
      await runSearch();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao remover vínculo" });
    } finally {
      setSaving(false);
    }
  }

  const resultCount = searchData.people.length + searchData.companies.length + searchData.projects.length + searchData.profiles.length;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(56,189,248,.08),transparent_30%),linear-gradient(180deg,#ffffff,#f7faff)] px-4 pb-28 pt-5 text-slate-950 dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,.10),transparent_28%),linear-gradient(180deg,#020617,#07111f)] dark:text-white sm:px-7 lg:px-10">
      {message ? (
        <div className={`fixed bottom-7 left-1/2 z-[120] flex w-[min(620px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${message.type === "success" ? "border-emerald-300/40 bg-emerald-50/95 text-emerald-950 dark:bg-emerald-950/90 dark:text-emerald-50" : "border-rose-300/40 bg-rose-50/95 text-rose-950 dark:bg-rose-950/90 dark:text-rose-50"}`}>
          {message.type === "success" ? <FiCheckCircle className="h-5 w-5 shrink-0" /> : <FiX className="h-5 w-5 shrink-0" />}
          <p className="min-w-0 flex-1 text-sm font-bold">{message.text}</p>
          <button type="button" onClick={() => setMessage(null)} aria-label="Fechar mensagem"><FiX /></button>
        </div>
      ) : null}

      <section className="mx-auto max-w-6xl">
        <div className="relative flex flex-col items-center text-center">
          <button type="button" onClick={() => setHistoryOpen(true)} className="absolute right-0 top-2 grid h-11 w-11 place-items-center rounded-full border border-slate-200/80 bg-white/70 text-slate-600 shadow-sm backdrop-blur transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/5 dark:text-slate-200" title="Histórico">
            <FiClock className="h-5 w-5" />
          </button>
          <BRAINVisual busy={loading || saving} />
          <p className="mt-1 text-[11px] font-black uppercase tracking-[0.32em] text-cyan-700/70 dark:text-cyan-200/70">Contexto seguro</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Gestão de Vínculos</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Pesquise pessoas, empresas, projetos ou perfis e controle as relações autorizadas sem apagar o histórico.</p>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void runSearch(); }} className="mx-auto mt-7 flex max-w-5xl flex-col gap-2 rounded-[1.7rem] border border-slate-200/80 bg-white/85 p-2 shadow-[0_18px_55px_rgba(15,23,42,.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70 sm:flex-row">
          <select value={mode} onChange={(event) => setMode(event.target.value as SearchMode)} className="h-12 rounded-2xl bg-transparent px-4 text-sm font-bold outline-none sm:w-36">
            <option value="all">Todos</option>
            <option value="people">Pessoas</option>
            <option value="companies">Empresas</option>
            <option value="projects">Projetos</option>
            <option value="profiles">Perfis</option>
          </select>
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-slate-100/80 px-4 dark:bg-white/[0.05]">
            <FiSearch className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, e-mail, empresa, projeto ou perfil..." className="h-12 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400" />
          </div>
          <button type="submit" disabled={loading} className="h-12 rounded-2xl bg-slate-950 px-7 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:opacity-50 dark:bg-cyan-300 dark:text-slate-950">
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </form>

        <div className="mt-8 border-y border-slate-200/80 dark:border-white/10">
          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Resultados</p>
              <h2 className="mt-1 text-lg font-black">{resultCount ? `${resultCount} encontrados` : "Comece pela busca"}</h2>
            </div>
            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-700 dark:text-cyan-200">{resultCount}</span>
          </div>

          {!loading && query.trim().length < 2 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center py-12 text-center">
              <FiLink2 className="h-9 w-9 text-cyan-500" />
              <p className="mt-4 text-sm font-bold text-slate-500 dark:text-slate-300">Digite pelo menos dois caracteres para localizar vínculos.</p>
            </div>
          ) : null}

          {!loading && query.trim().length >= 2 && resultCount === 0 ? (
            <div className="py-16 text-center text-sm font-semibold text-slate-500 dark:text-slate-300">Nenhum resultado encontrado no contexto autorizado.</div>
          ) : null}

          <div className="divide-y divide-slate-200/80 dark:divide-white/10">
            {searchData.people.map((person) => {
              const key = `person:${person.id}`;
              const open = expandedKey === key;
              return (
                <div key={key}>
                  <button type="button" onClick={() => void loadPerson(person.id)} className="flex w-full items-center gap-4 py-5 text-left transition hover:bg-cyan-500/[0.035]">
                    <FiUser className="h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black">{displayName(person)}</p>
                      <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{roleLabel(person.globalRole ?? person.role)} · {person.email}</p>
                    </div>
                    {open ? <FiChevronUp /> : <FiChevronDown />}
                  </button>
                  {open && selectedPerson ? (
                    <div className="pb-6 pl-9 pr-2">
                      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Vínculos atuais</p>
                          <div className="mt-3 divide-y divide-slate-200/80 border-y border-slate-200/80 dark:divide-white/10 dark:border-white/10">
                            {activeAssignments.length === 0 ? <p className="py-4 text-sm text-slate-500">Nenhum vínculo de projeto ativo.</p> : null}
                            {activeAssignments.map((assignment) => (
                              <div key={assignment.id} className="flex items-center gap-3 py-4">
                                <FiBriefcase className="text-cyan-600" />
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold">{assignment.project.name}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{companyName(assignment.company)} · {roleLabel(assignment.role)}</p>
                                </div>
                                {searchData.permissions.canDelete && assignment.role !== "leader_tc" ? (
                                  <button type="button" onClick={() => setRemoveTarget(assignment)} className="rounded-full p-2 text-rose-500 hover:bg-rose-500/10" title="Remover vínculo"><FiTrash2 /></button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>

                        {searchData.permissions.canCreate || baseData.permissions.canManage ? (
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Criar vínculo</p>
                            <div className="mt-3 grid gap-3">
                              <select value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-transparent px-3 text-sm font-bold dark:border-white/10">
                                <option value="">Selecione a empresa</option>
                                {baseData.companies.map((company) => <option key={company.id} value={company.id}>{companyName(company)}</option>)}
                              </select>
                              <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-transparent px-3 text-sm font-bold dark:border-white/10">
                                <option value="">Selecione o projeto</option>
                                {availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                              </select>
                              <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => setSelectedRole("leader_tc")} className={`h-10 rounded-xl border text-xs font-black ${selectedRole === "leader_tc" ? "border-cyan-500 bg-cyan-500/10" : "border-slate-200 dark:border-white/10"}`}>Líder TC</button>
                                <button type="button" onClick={() => setSelectedRole("qa_tc")} className={`h-10 rounded-xl border text-xs font-black ${selectedRole === "qa_tc" ? "border-cyan-500 bg-cyan-500/10" : "border-slate-200 dark:border-white/10"}`}>Usuário TC</button>
                              </div>
                              <button type="button" onClick={() => void createAssignment()} disabled={saving || !selectedProjectId} className="h-11 rounded-xl bg-slate-950 text-sm font-black text-white disabled:opacity-40 dark:bg-cyan-300 dark:text-slate-950">Confirmar vínculo</button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {searchData.companies.map((company) => {
              const key = `company:${company.id}`;
              const open = expandedKey === key;
              const projects = searchData.projects.filter((item) => item.companyId === company.id);
              return (
                <div key={key}>
                  <button type="button" onClick={() => selectSimple("company", company.id)} className="flex w-full items-center gap-4 py-5 text-left transition hover:bg-cyan-500/[0.035]">
                    <FiBuilding className="h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-300" />
                    <div className="min-w-0 flex-1"><p className="truncate font-black">{companyName(company)}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Empresa · {projects.length} projetos · {selectedCompanyAssignments.length} vínculos localizados</p></div>
                    {open ? <FiChevronUp /> : <FiChevronDown />}
                  </button>
                  {open ? (
                    <div className="grid gap-4 pb-6 pl-9 md:grid-cols-2">
                      <div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Projetos</p>{projects.length ? projects.map((project) => <p key={project.id} className="mt-2 text-sm font-bold">{project.name}</p>) : <p className="mt-2 text-sm text-slate-500">Nenhum projeto apareceu nesta busca.</p>}</div>
                      <div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Equipe vinculada</p>{selectedCompanyAssignments.length ? selectedCompanyAssignments.map((assignment) => <p key={assignment.id} className="mt-2 text-sm font-bold">{assignment.user?.full_name || assignment.user?.name} · {assignment.project.name} · {roleLabel(assignment.role)}</p>) : <p className="mt-2 text-sm text-slate-500">Nenhum vínculo apareceu nesta busca.</p>}</div>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {searchData.projects.map((project) => {
              const key = `project:${project.id}`;
              const open = expandedKey === key;
              const leader = selectedProjectAssignments.find((item) => item.role === "leader_tc");
              const members = selectedProjectAssignments.filter((item) => item.role === "qa_tc");
              return (
                <div key={key}>
                  <button type="button" onClick={() => selectSimple("project", project.id)} className="flex w-full items-center gap-4 py-5 text-left transition hover:bg-cyan-500/[0.035]">
                    <FiFolder className="h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-300" />
                    <div className="min-w-0 flex-1"><p className="truncate font-black">{project.name}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{companyName(project.company)} · Projeto</p></div>
                    {open ? <FiChevronUp /> : <FiChevronDown />}
                  </button>
                  {open ? (
                    <div className="grid gap-4 pb-6 pl-9 md:grid-cols-2">
                      <div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Liderança</p><p className="mt-2 text-sm font-bold">{leader?.user?.full_name || leader?.user?.name || "Sem líder localizado"}</p></div>
                      <div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Usuários TC</p><p className="mt-2 text-sm font-bold">{members.length} vinculados nesta busca</p></div>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {searchData.profiles.map((profile) => {
              const key = `profile:${profile.role}`;
              const open = expandedKey === key;
              return (
                <div key={key}>
                  <button type="button" onClick={() => selectSimple("profile", profile.role)} className="flex w-full items-center gap-4 py-5 text-left transition hover:bg-cyan-500/[0.035]">
                    <FiUsers className="h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-300" />
                    <div className="min-w-0 flex-1"><p className="font-black">{roleLabel(profile.role)}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Perfil · {profile.count} pessoas encontradas</p></div>
                    {open ? <FiChevronUp /> : <FiChevronDown />}
                  </button>
                  {open ? <div className="pb-6 pl-9">{selectedProfilePeople.map((person) => <button key={person.id} type="button" onClick={() => void loadPerson(person.id)} className="mr-3 mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-bold dark:border-white/10">{displayName(person)} <FiArrowRight /></button>)}</div> : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {historyOpen ? (
        <div className="fixed inset-0 z-[110] bg-slate-950/35 backdrop-blur-sm" onClick={() => setHistoryOpen(false)}>
          <aside className="absolute bottom-0 right-0 top-0 w-[min(430px,92vw)] overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-950" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Histórico</p><h2 className="mt-1 text-xl font-black">Alterações de vínculo</h2></div><button type="button" onClick={() => setHistoryOpen(false)}><FiX /></button></div>
            <div className="mt-6 divide-y divide-slate-200 dark:divide-white/10">
              {historyAssignments.length === 0 ? <p className="py-8 text-sm text-slate-500">Selecione uma pessoa para visualizar o histórico preservado.</p> : null}
              {historyAssignments.map((assignment) => <div key={assignment.id} className="py-4"><p className="font-bold">{assignment.project.name}</p><p className="mt-1 text-xs text-slate-500">{companyName(assignment.company)} · {roleLabel(assignment.role)}</p><p className="mt-2 text-xs text-slate-500">{assignment.removalReason || "Sem justificativa registrada"}</p></div>)}
            </div>
          </aside>
        </div>
      ) : null}

      {removeTarget ? (
        <div className="fixed inset-0 z-[115] grid place-items-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-950">
            <div className="flex items-center justify-between"><h2 className="text-xl font-black">Remover vínculo</h2><button type="button" onClick={() => setRemoveTarget(null)}><FiX /></button></div>
            <p className="mt-2 text-sm text-slate-500">{removeTarget.project.name} · {companyName(removeTarget.company)}</p>
            <textarea value={removeReason} onChange={(event) => setRemoveReason(event.target.value)} placeholder="Informe a justificativa" className="mt-5 min-h-28 w-full rounded-2xl border border-slate-200 bg-transparent p-4 text-sm outline-none dark:border-white/10" />
            <div className="mt-4 flex justify-end gap-3"><button type="button" onClick={() => setRemoveTarget(null)} className="rounded-xl px-4 py-2 text-sm font-bold">Cancelar</button><button type="button" onClick={() => void removeAssignment()} disabled={saving} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Confirmar remoção</button></div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
