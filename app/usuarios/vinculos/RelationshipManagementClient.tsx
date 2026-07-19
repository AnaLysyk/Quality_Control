"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  FiArrowLeft,
  FiArrowRight,
  FiBriefcase,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiHome,
  FiMinus,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi";

type SearchMode = "companies" | "leaders" | "qa_users" | "business_users";
type Company = { id: string; name: string; company_name?: string | null; slug: string };
type Project = { id: string; companyId: string; name: string; slug: string; status: string };
type Assignment = {
  id: string;
  role: string;
  status: string;
  removedAt?: string | null;
  removalReason?: string | null;
  company: Company;
  project: { id: string; name: string; slug: string };
  user?: { id: string; name: string; full_name?: string | null; email: string };
};
type Membership = {
  companyId: string;
  role?: string | null;
  allowedProjectIds?: string[];
  company: Company;
};
type Person = {
  id: string;
  name: string;
  full_name?: string | null;
  email: string;
  user?: string | null;
  role?: string | null;
  globalRole?: string | null;
  status: string;
  active: boolean;
  memberships?: Membership[];
  projectTeamAssignments?: Assignment[];
};
type ResultItem =
  | { kind: "person"; id: string; person: Person }
  | { kind: "company"; id: string; company: Company };
type SearchResponse = {
  mode: SearchMode;
  modeLabel: string;
  allowedModes: SearchMode[];
  operatorRole: string;
  companyOperator: boolean;
  companies: Company[];
  projects: Project[];
  people: Person[];
  assignments: Assignment[];
  permissions: { canCreate: boolean; canEdit: boolean; canDelete: boolean };
};
type BaseResponse = {
  companies: Company[];
  projects: Project[];
  permissions: { canManage: boolean };
};

const PAGE_SIZE = 5;
const MIN_SEARCH_LENGTH = 3;
const ALL_MODES: SearchMode[] = ["companies", "leaders", "qa_users", "business_users"];
const EMPTY_SEARCH: SearchResponse = {
  mode: "qa_users",
  modeLabel: "Usuário TC",
  allowedModes: ALL_MODES,
  operatorRole: "",
  companyOperator: false,
  companies: [],
  projects: [],
  people: [],
  assignments: [],
  permissions: { canCreate: false, canEdit: false, canDelete: false },
};

const MODE_LABEL: Record<SearchMode, string> = {
  companies: "Empresas",
  leaders: "Líder TC",
  qa_users: "Usuário TC",
  business_users: "Usuário empresarial",
};

const MODE_ICON: Record<SearchMode, ReactNode> = {
  companies: <FiHome />,
  leaders: <FiUsers />,
  qa_users: <FiUser />,
  business_users: <FiBriefcase />,
};

const ROLE_LABEL: Record<string, string> = {
  leader_tc: "Líder TC",
  qa_tc: "Usuário TC",
  testing_company_user: "Usuário TC",
  technical_support: "Administrador",
  support: "Administrador",
  company_admin: "Empresa",
  empresa: "Empresa",
  company: "Empresa",
  company_user: "Usuário empresarial",
  business_user: "Usuário empresarial",
  user: "Usuário empresarial",
};

const personName = (person: Person) => person.full_name || person.name || person.user || person.email;
const companyName = (company?: Company | null) => company?.company_name || company?.name || "Empresa";
const roleLabel = (role?: string | null) => ROLE_LABEL[String(role ?? "user")] ?? String(role ?? "Usuário").replaceAll("_", " ");
const normalize = (value?: string | null) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function resultScore(item: ResultItem, query: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;
  if (item.kind === "company") {
    const fields = [companyName(item.company), item.company.slug].map(normalize);
    if (fields.some((field) => field === normalizedQuery)) return 130;
    if (fields.some((field) => field.startsWith(normalizedQuery))) return 110;
    if (fields.some((field) => field.includes(normalizedQuery))) return 80;
    return 10;
  }
  const emailLocal = normalize(item.person.email.split("@")[0]);
  const names = [personName(item.person), item.person.name, item.person.full_name, item.person.user].map(normalize);
  if (names.some((field) => field === normalizedQuery) || emailLocal === normalizedQuery) return 140;
  if (names.some((field) => field.startsWith(normalizedQuery)) || emailLocal.startsWith(normalizedQuery)) return 120;
  if (names.some((field) => field.includes(normalizedQuery)) || emailLocal.includes(normalizedQuery)) return 95;
  return 20;
}

function BrainVisual({ busy }: { busy: boolean }) {
  return (
    <div className="relationship-brain" data-busy={busy} aria-label="BRAIN visual">
      <img src="/brain-orb-reference.svg" alt="BRAIN" />
    </div>
  );
}

function Row({ icon, title, subtitle, badge, open, onClick, children }: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  badge: string;
  open: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="relationship-row" data-open={open}>
      <button type="button" className="relationship-row-trigger" onClick={onClick}>
        <span className="text-cyan-600 dark:text-cyan-300">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-black">{title}</span>
            <span className="relationship-role-badge">{badge}</span>
          </span>
          <span className="mt-1 block truncate text-xs" style={{ color: "var(--rel-muted)" }}>{subtitle}</span>
        </span>
        {open ? <FiChevronUp /> : <FiChevronDown />}
      </button>
      {open ? <div className="relationship-row-detail">{children}</div> : null}
    </div>
  );
}

export default function RelationshipManagementClient() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("qa_users");
  const [data, setData] = useState<SearchResponse>(EMPTY_SEARCH);
  const [base, setBase] = useState<BaseResponse>({ companies: [], projects: [], permissions: { canManage: false } });
  const [selected, setSelected] = useState<{ kind: ResultItem["kind"]; id: string } | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [page, setPage] = useState(1);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [removeTarget, setRemoveTarget] = useState<Assignment | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const searchRequestRef = useRef<AbortController | null>(null);

  const results = useMemo<ResultItem[]>(() => {
    const merged: ResultItem[] = mode === "companies"
      ? data.companies.map((item) => ({ kind: "company" as const, id: item.id, company: item }))
      : data.people.map((item) => ({ kind: "person" as const, id: item.id, person: item }));
    return merged.sort((left, right) => resultScore(right, query) - resultScore(left, query));
  }, [data, mode, query]);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const visibleResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const availableProjects = useMemo(() => base.projects.filter((item) => !companyId || item.companyId === companyId), [base.projects, companyId]);
  const activeAssignments = person?.projectTeamAssignments?.filter((item) => item.status === "active") ?? [];
  const visibleAssignments = activeAssignments.filter((assignment) => {
    if (mode === "leaders") return assignment.role === "leader_tc";
    if (mode === "qa_users") return assignment.role === "qa_tc";
    return true;
  });
  const historyAssignments = person?.projectTeamAssignments?.filter((item) => item.status !== "active") ?? [];
  const allowedModes = data.allowedModes.length ? data.allowedModes : ALL_MODES;

  useEffect(() => {
    void loadBase();
    void search("", mode);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length > 0 && trimmed.length < MIN_SEARCH_LENGTH) return;
    const timer = window.setTimeout(() => { void search(trimmed, mode); }, trimmed ? 420 : 80);
    return () => window.clearTimeout(timer);
  }, [query, mode]);

  useEffect(() => () => searchRequestRef.current?.abort(), []);

  async function loadBase() {
    try {
      const response = await fetch("/api/usuarios/vinculos", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao carregar contextos");
      setBase(body);
      if (body.companies?.[0]?.id) setCompanyId(body.companies[0].id);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao carregar contextos" });
    }
  }

  async function search(searchQuery = query.trim(), searchMode = mode) {
    if (searchQuery.length > 0 && searchQuery.length < MIN_SEARCH_LENGTH) return;
    searchRequestRef.current?.abort();
    const controller = new AbortController();
    searchRequestRef.current = controller;
    setLoading(true);
    setSelected(null);
    setPerson(null);
    setAddFormOpen(false);
    setPage(1);
    try {
      const params = new URLSearchParams({ mode: searchMode });
      if (searchQuery) params.set("q", searchQuery);
      const response = await fetch(`/api/usuarios/vinculos/search?${params.toString()}`, { cache: "no-store", signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao pesquisar vínculos");
      setData(body);
      if (!body.allowedModes?.includes(searchMode) && body.allowedModes?.[0]) setMode(body.allowedModes[0]);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao pesquisar vínculos" });
    } finally {
      if (searchRequestRef.current === controller) setLoading(false);
    }
  }

  async function openPerson(id: string, forceReload = false) {
    if (!forceReload && selected?.kind === "person" && selected.id === id) {
      setSelected(null);
      setPerson(null);
      setAddFormOpen(false);
      return;
    }
    setLoading(true);
    setSelected({ kind: "person", id });
    setAddFormOpen(false);
    try {
      const response = await fetch(`/api/usuarios/vinculos?personId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao carregar pessoa");
      setPerson(body.person);
      setCompanyId(body.person.memberships?.[0]?.companyId || body.person.projectTeamAssignments?.[0]?.company?.id || base.companies[0]?.id || "");
      setProjectId("");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao carregar pessoa" });
    } finally {
      setLoading(false);
    }
  }

  function toggleCompany(id: string) {
    setSelected((current) => current?.kind === "company" && current.id === id ? null : { kind: "company", id });
    setPerson(null);
    setAddFormOpen(false);
  }

  async function createQaAssignment() {
    if (!person || !companyId || !projectId) {
      setMessage({ type: "error", text: "Selecione empresa e projeto." });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/usuarios/vinculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: person.id, companyId, projectId, role: "qa_tc" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao criar vínculo");
      setMessage({ type: "success", text: "BRAIN confirmou: projeto vinculado ao Usuário TC." });
      setAddFormOpen(false);
      await openPerson(person.id, true);
      await search(query.trim(), mode);
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
      const currentPersonId = person?.id;
      setMessage({ type: "success", text: "BRAIN confirmou: vínculo removido e histórico preservado." });
      setRemoveTarget(null);
      setRemoveReason("");
      if (currentPersonId) await openPerson(currentPersonId, true);
      await search(query.trim(), mode);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao remover vínculo" });
    } finally {
      setSaving(false);
    }
  }

  function renderPerson(item: Extract<ResultItem, { kind: "person" }>) {
    const open = selected?.kind === "person" && selected.id === item.id;
    const membershipCount = item.person.memberships?.length ?? 0;
    const projectCount = item.person.projectTeamAssignments?.length ?? 0;
    const badge = MODE_LABEL[mode];
    const subtitle = `${item.person.email} · ${membershipCount} empresa${membershipCount === 1 ? "" : "s"} · ${projectCount} projeto${projectCount === 1 ? "" : "s"}`;

    return (
      <Row key={item.id} icon={MODE_ICON[mode]} title={personName(item.person)} subtitle={subtitle} badge={badge} open={open} onClick={() => void openPerson(item.id)}>
        {person ? (
          <div className="relationship-person-context">
            <section className="relationship-inline-section">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {mode === "leaders" ? "Projetos sob liderança" : mode === "business_users" ? "Empresas e acessos empresariais" : "Projetos autorizados"}
              </p>

              {mode === "business_users" ? (
                person.memberships?.length ? person.memberships.map((membership) => {
                  const allowedIds = membership.allowedProjectIds ?? [];
                  const allowedProjects = allowedIds.length
                    ? base.projects.filter((project) => allowedIds.includes(project.id))
                    : base.projects.filter((project) => project.companyId === membership.companyId);
                  return (
                    <div key={membership.companyId} className="relationship-link-line">
                      <FiHome />
                      <div className="flex-1">
                        <p className="font-bold">{companyName(membership.company)}</p>
                        <p className="text-xs" style={{ color: "var(--rel-muted)" }}>
                          {allowedIds.length ? `${allowedProjects.length} projetos selecionados` : "Todos os projetos da empresa"}
                        </p>
                      </div>
                    </div>
                  );
                }) : <p className="mt-3 text-sm" style={{ color: "var(--rel-muted)" }}>Nenhuma empresa vinculada.</p>
              ) : visibleAssignments.length ? visibleAssignments.map((assignment) => (
                <div key={assignment.id} className="relationship-link-line">
                  <FiBriefcase />
                  <div className="flex-1">
                    <p className="font-bold">{companyName(assignment.company)}</p>
                    <p className="text-xs" style={{ color: "var(--rel-muted)" }}>{assignment.project.name} · {roleLabel(assignment.role)}</p>
                  </div>
                  {mode === "qa_users" && data.permissions.canDelete ? (
                    <button type="button" onClick={() => setRemoveTarget(assignment)} className="text-rose-500" title="Remover vínculo"><FiTrash2 /></button>
                  ) : null}
                </div>
              )) : <p className="mt-3 text-sm" style={{ color: "var(--rel-muted)" }}>Nenhum vínculo ativo neste contexto.</p>}
            </section>

            <section className="relationship-inline-section">
              {mode === "qa_users" && data.permissions.canCreate ? (
                <>
                  <button type="button" onClick={() => setAddFormOpen((current) => !current)} className="relationship-add-toggle">
                    {addFormOpen ? <FiMinus /> : <FiPlus />}
                    <span>{addFormOpen ? "Fechar inclusão" : "Adicionar projeto"}</span>
                  </button>
                  {addFormOpen ? (
                    <div className="relationship-inline-form mt-3">
                      <select value={companyId} onChange={(event) => { setCompanyId(event.target.value); setProjectId(""); }} className="h-10 rounded-xl px-3 text-xs font-bold">
                        <option value="">Empresa</option>
                        {base.companies.map((company) => <option key={company.id} value={company.id}>{companyName(company)}</option>)}
                      </select>
                      <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="h-10 rounded-xl px-3 text-xs font-bold">
                        <option value="">Projeto</option>
                        {availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                      </select>
                      <button type="button" onClick={() => void createQaAssignment()} disabled={saving || !projectId} className="col-span-full h-10 rounded-xl bg-slate-950 text-xs font-black text-white disabled:opacity-40 dark:bg-cyan-300 dark:text-slate-950">Confirmar projeto</button>
                    </div>
                  ) : <p className="mt-2 text-xs" style={{ color: "var(--rel-muted)" }}>A empresa mantém a decisão final sobre os projetos autorizados.</p>}
                </>
              ) : mode === "leaders" ? (
                <div className="relationship-context-note">
                  <p className="font-black">Liderança não é removida diretamente.</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--rel-muted)" }}>A alteração será feita por substituição de líder, preservando a equipe e o histórico.</p>
                </div>
              ) : mode === "business_users" ? (
                <div className="relationship-context-note">
                  <p className="font-black">Acesso definido pela empresa.</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--rel-muted)" }}>A edição de projetos empresariais será ativada com o novo estado explícito de acesso: todos, selecionados ou nenhum.</p>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </Row>
    );
  }

  function renderCompany(item: Extract<ResultItem, { kind: "company" }>) {
    const assignments = data.assignments.filter((assignment) => assignment.company.id === item.id);
    const leaders = assignments.filter((assignment) => assignment.role === "leader_tc");
    const qaUsers = assignments.filter((assignment) => assignment.role === "qa_tc");
    const projectCount = new Set(assignments.map((assignment) => assignment.project.id)).size;
    return (
      <Row
        key={item.id}
        icon={<FiHome />}
        title={companyName(item.company)}
        subtitle={`${projectCount} projetos · ${leaders.length} líderes · ${qaUsers.length} usuários TC`}
        badge="Empresa"
        open={selected?.kind === "company" && selected.id === item.id}
        onClick={() => toggleCompany(item.id)}
      >
        <div className="relationship-company-context">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Liderança e equipe por projeto</p>
          {assignments.length ? assignments.map((assignment) => (
            <div key={assignment.id} className="relationship-link-line">
              <FiUsers />
              <div className="flex-1">
                <p className="font-bold">{assignment.user?.full_name || assignment.user?.name}</p>
                <p className="text-xs" style={{ color: "var(--rel-muted)" }}>{assignment.project.name} · {roleLabel(assignment.role)}</p>
              </div>
            </div>
          )) : <p className="mt-3 text-sm" style={{ color: "var(--rel-muted)" }}>Nenhum vínculo ativo encontrado para esta empresa.</p>}
        </div>
      </Row>
    );
  }

  return (
    <main className="relationship-shell">
      {message ? (
        <div className={`fixed bottom-6 left-1/2 z-[120] flex w-[min(620px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${message.type === "success" ? "border-emerald-300/40 bg-emerald-50/95 text-emerald-950 dark:bg-emerald-950/90 dark:text-emerald-50" : "border-rose-300/40 bg-rose-50/95 text-rose-950 dark:bg-rose-950/90 dark:text-rose-50"}`}>
          {message.type === "success" ? <FiCheckCircle /> : <FiX />}
          <p className="flex-1 text-sm font-bold">{message.text}</p>
          <button type="button" onClick={() => setMessage(null)}><FiX /></button>
        </div>
      ) : null}

      <section className="relationship-stage">
        <header className="relationship-hero">
          <button type="button" onClick={() => setHistoryOpen(true)} className="absolute right-0 top-1 grid h-10 w-10 place-items-center rounded-full border bg-transparent" style={{ borderColor: "var(--rel-line)" }} title="Histórico"><FiClock /></button>
          <BrainVisual busy={loading || saving} />
          <p className="text-[10px] font-black uppercase tracking-[0.34em] text-cyan-700/70 dark:text-cyan-200/70">BRAIN · Contexto seguro</p>
          <h1 className="mt-1 text-3xl font-black sm:text-4xl">Gestão de Vínculos</h1>
          <p className="mx-auto mt-1 max-w-2xl text-sm" style={{ color: "var(--rel-muted)" }}>Escolha o tipo de vínculo e pesquise dentro do contexto autorizado.</p>
        </header>

        <div className="relationship-mode-tabs" role="tablist" aria-label="Tipos de vínculo">
          {allowedModes.map((itemMode) => (
            <button key={itemMode} type="button" role="tab" aria-selected={mode === itemMode} data-active={mode === itemMode} onClick={() => { setMode(itemMode); setSelected(null); setPerson(null); setAddFormOpen(false); }}>
              {MODE_ICON[itemMode]}
              <span>{MODE_LABEL[itemMode]}</span>
            </button>
          ))}
        </div>

        <form className="relationship-search relationship-search-simple" onSubmit={(event) => { event.preventDefault(); void search(query.trim(), mode); }}>
          <div className="relationship-search-field">
            <FiSearch className="text-cyan-600 dark:text-cyan-300" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar em ${MODE_LABEL[mode]}...`} />
          </div>
          <button type="submit" disabled={loading || (query.trim().length > 0 && query.trim().length < MIN_SEARCH_LENGTH)} className="relationship-search-submit">{loading ? "Buscando…" : "Buscar"}</button>
        </form>

        <section className="relationship-results">
          <div className="relationship-results-header">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{MODE_LABEL[mode]}</p>
              <h2 className="mt-1 text-lg font-black">{results.length ? `${results.length} encontrados` : "Nenhum registro"}</h2>
            </div>
            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-700 dark:text-cyan-200">{results.length}</span>
          </div>

          <div className="relationship-results-scroll">
            {!loading && query.trim().length > 0 && query.trim().length < MIN_SEARCH_LENGTH ? <div className="flex h-full min-h-[120px] items-center justify-center text-sm font-bold" style={{ color: "var(--rel-muted)" }}>Digite pelo menos três caracteres.</div> : null}
            {!loading && !(query.trim().length > 0 && query.trim().length < MIN_SEARCH_LENGTH) && results.length === 0 ? <div className="flex h-full min-h-[120px] items-center justify-center text-sm font-bold" style={{ color: "var(--rel-muted)" }}>Nenhum resultado disponível neste contexto.</div> : null}
            {visibleResults.map((item) => item.kind === "company" ? renderCompany(item) : renderPerson(item))}
          </div>

          {results.length > PAGE_SIZE ? (
            <nav className="relationship-pagination" aria-label="Paginação dos resultados">
              <button type="button" className="relationship-page-button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><FiArrowLeft /></button>
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => <button key={pageNumber} type="button" className="relationship-page-button" data-active={pageNumber === page} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}
              <button type="button" className="relationship-page-button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}><FiArrowRight /></button>
            </nav>
          ) : null}
        </section>
      </section>

      {historyOpen ? (
        <div className="fixed inset-0 z-[110] bg-slate-950/35 backdrop-blur-sm" onClick={() => setHistoryOpen(false)}>
          <aside className="absolute bottom-0 right-0 top-0 w-[min(430px,92vw)] overflow-y-auto border-l bg-white p-6 shadow-2xl dark:bg-slate-950" style={{ borderColor: "var(--rel-line)" }} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Histórico</p><h2 className="mt-1 text-xl font-black">Alterações de vínculo</h2></div>
              <button type="button" onClick={() => setHistoryOpen(false)}><FiX /></button>
            </div>
            <div className="mt-6 divide-y" style={{ borderColor: "var(--rel-line)" }}>
              {historyAssignments.length === 0 ? <p className="py-8 text-sm" style={{ color: "var(--rel-muted)" }}>Selecione uma pessoa para visualizar o histórico.</p> : historyAssignments.map((assignment) => <div key={assignment.id} className="py-4"><p className="font-bold">{assignment.project.name}</p><p className="mt-1 text-xs" style={{ color: "var(--rel-muted)" }}>{companyName(assignment.company)} · {roleLabel(assignment.role)}</p><p className="mt-2 text-xs" style={{ color: "var(--rel-muted)" }}>{assignment.removalReason || "Sem justificativa registrada"}</p></div>)}
            </div>
          </aside>
        </div>
      ) : null}

      {removeTarget ? (
        <div className="fixed inset-0 z-[115] grid place-items-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-950">
            <div className="flex items-center justify-between"><h2 className="text-xl font-black">Remover vínculo</h2><button type="button" onClick={() => setRemoveTarget(null)}><FiX /></button></div>
            <p className="mt-2 text-sm" style={{ color: "var(--rel-muted)" }}>{removeTarget.project.name} · {companyName(removeTarget.company)}</p>
            <textarea value={removeReason} onChange={(event) => setRemoveReason(event.target.value)} placeholder="Informe a justificativa" className="mt-5 min-h-28 w-full rounded-2xl border bg-transparent p-4 text-sm outline-none" style={{ borderColor: "var(--rel-line)" }} />
            <div className="mt-4 flex justify-end gap-3"><button type="button" onClick={() => setRemoveTarget(null)} className="rounded-xl px-4 py-2 text-sm font-bold">Cancelar</button><button type="button" onClick={() => void removeAssignment()} disabled={saving} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Confirmar remoção</button></div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
