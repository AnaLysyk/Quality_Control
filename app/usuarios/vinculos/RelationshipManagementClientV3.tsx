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

import BusinessUserManagementPanel from "./BusinessUserManagementPanel";
import LeaderManagementPanel from "./LeaderManagementPanel";

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
type Membership = { companyId: string; role?: string | null; allowedProjectIds?: string[]; company: Company };
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
type BaseResponse = { companies: Company[]; projects: Project[]; permissions: { canManage: boolean } };
type ResultItem = { kind: "person"; id: string; person: Person } | { kind: "company"; id: string; company: Company };

const PAGE_SIZE = 5;
const MIN_SEARCH_LENGTH = 3;
const ALL_MODES: SearchMode[] = ["companies", "leaders", "qa_users", "business_users"];
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

const personName = (person?: Person | Assignment["user"] | null) => person?.full_name || person?.name || person?.email || "Pessoa";
const companyName = (company?: Company | null) => company?.company_name || company?.name || "Empresa";

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
        <span className="relationship-row-icon">{icon}</span>
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

export default function RelationshipManagementClientV3() {
  const [mode, setMode] = useState<SearchMode>("qa_users");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse>(EMPTY_SEARCH);
  const [base, setBase] = useState<BaseResponse>({ companies: [], projects: [], permissions: { canManage: false } });
  const [selected, setSelected] = useState<{ kind: ResultItem["kind"]; id: string } | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [page, setPage] = useState(1);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [removeTarget, setRemoveTarget] = useState<Assignment | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const results = useMemo<ResultItem[]>(() => mode === "companies"
    ? data.companies.map((company) => ({ kind: "company" as const, id: company.id, company }))
    : data.people.map((personItem) => ({ kind: "person" as const, id: personItem.id, person: personItem })), [data, mode]);
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const visibleResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allowedModes = data.allowedModes.length ? data.allowedModes : ALL_MODES;
  const availableProjects = base.projects.filter((project) => project.companyId === companyId);
  const activeAssignments = person?.projectTeamAssignments?.filter((assignment) => assignment.status === "active") ?? [];
  const qaAssignments = activeAssignments.filter((assignment) => assignment.role === "qa_tc");
  const historyAssignments = person?.projectTeamAssignments?.filter((assignment) => assignment.status !== "active") ?? [];

  useEffect(() => {
    void loadBase();
    void search("", mode);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length > 0 && trimmed.length < MIN_SEARCH_LENGTH) return;
    const timer = window.setTimeout(() => { void search(trimmed, mode); }, trimmed ? 420 : 80);
    return () => window.clearTimeout(timer);
  }, [query, mode]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  useEffect(() => () => requestRef.current?.abort(), []);

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
  }

  async function loadBase() {
    try {
      const response = await fetch("/api/usuarios/vinculos", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao carregar empresas e projetos");
      setBase(body);
      if (body.companies?.[0]?.id) setCompanyId(body.companies[0].id);
    } catch (error) {
      showMessage("error", error instanceof Error ? error.message : "Falha ao carregar contextos");
    }
  }

  async function search(searchQuery = query.trim(), searchMode = mode) {
    if (searchQuery.length > 0 && searchQuery.length < MIN_SEARCH_LENGTH) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setSelected(null);
    setPerson(null);
    setAddOpen(false);
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
      showMessage("error", error instanceof Error ? error.message : "Falha ao pesquisar vínculos");
    } finally {
      if (requestRef.current === controller) setLoading(false);
    }
  }

  async function openPerson(id: string, force = false) {
    if (!force && selected?.kind === "person" && selected.id === id) {
      setSelected(null);
      setPerson(null);
      setAddOpen(false);
      return;
    }
    setSelected({ kind: "person", id });
    setLoading(true);
    try {
      const response = await fetch(`/api/usuarios/vinculos?personId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao carregar pessoa");
      setPerson(body.person);
      setCompanyId(body.person.memberships?.[0]?.companyId || body.person.projectTeamAssignments?.[0]?.company?.id || base.companies[0]?.id || "");
      setProjectId("");
    } catch (error) {
      showMessage("error", error instanceof Error ? error.message : "Falha ao carregar pessoa");
    } finally {
      setLoading(false);
    }
  }

  async function refreshPersonAndSearch() {
    const id = person?.id;
    if (id) await openPerson(id, true);
    await search(query.trim(), mode);
  }

  async function addQaProject() {
    if (!person || !companyId || !projectId) {
      showMessage("error", "Selecione empresa e projeto.");
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
      showMessage("success", "BRAIN confirmou: projeto vinculado ao Usuário TC.");
      setAddOpen(false);
      await refreshPersonAndSearch();
    } catch (error) {
      showMessage("error", error instanceof Error ? error.message : "Falha ao criar vínculo");
    } finally {
      setSaving(false);
    }
  }

  async function removeQaProject() {
    if (!removeTarget || !removeReason.trim()) {
      showMessage("error", "Informe a justificativa da remoção.");
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
      showMessage("success", "BRAIN confirmou: vínculo removido e histórico preservado.");
      setRemoveTarget(null);
      setRemoveReason("");
      await refreshPersonAndSearch();
    } catch (error) {
      showMessage("error", error instanceof Error ? error.message : "Falha ao remover vínculo");
    } finally {
      setSaving(false);
    }
  }

  function renderPerson(item: Extract<ResultItem, { kind: "person" }>) {
    const open = selected?.kind === "person" && selected.id === item.id;
    const membershipCount = item.person.memberships?.length ?? 0;
    const projectCount = item.person.projectTeamAssignments?.length ?? 0;

    return (
      <Row
        key={item.id}
        icon={MODE_ICON[mode]}
        title={personName(item.person)}
        subtitle={`${item.person.email} · ${membershipCount} empresa${membershipCount === 1 ? "" : "s"} · ${projectCount} projeto${projectCount === 1 ? "" : "s"}`}
        badge={MODE_LABEL[mode]}
        open={open}
        onClick={() => void openPerson(item.id)}
      >
        {person ? mode === "leaders" ? (
          <LeaderManagementPanel
            leader={person}
            companies={base.companies}
            projects={base.projects}
            canEdit={data.permissions.canEdit || data.permissions.canCreate}
            onChanged={refreshPersonAndSearch}
            onMessage={showMessage}
          />
        ) : mode === "qa_users" ? (
          <div className="relationship-person-context">
            <section className="relationship-inline-section">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Projetos autorizados</p>
              {qaAssignments.length === 0 ? <p className="mt-3 text-sm" style={{ color: "var(--rel-muted)" }}>Nenhum projeto vinculado.</p> : qaAssignments.map((assignment) => (
                <div key={assignment.id} className="relationship-link-line">
                  <FiBriefcase />
                  <div className="flex-1">
                    <p className="font-bold">{companyName(assignment.company)}</p>
                    <p className="text-xs" style={{ color: "var(--rel-muted)" }}>{assignment.project.name}</p>
                  </div>
                  {data.permissions.canDelete ? <button type="button" title="Remover vínculo" onClick={() => setRemoveTarget(assignment)}><FiTrash2 /></button> : null}
                </div>
              ))}
            </section>
            <section className="relationship-inline-section">
              {data.permissions.canCreate ? (
                <>
                  <button type="button" className="relationship-add-toggle" onClick={() => setAddOpen((current) => !current)}>
                    {addOpen ? <FiMinus /> : <FiPlus />} <span>{addOpen ? "Fechar inclusão" : "Adicionar projeto"}</span>
                  </button>
                  {addOpen ? (
                    <div className="relationship-inline-form mt-3">
                      <select value={companyId} onChange={(event) => { setCompanyId(event.target.value); setProjectId(""); }}>
                        <option value="">Empresa</option>
                        {base.companies.map((company) => <option key={company.id} value={company.id}>{companyName(company)}</option>)}
                      </select>
                      <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                        <option value="">Projeto</option>
                        {availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                      </select>
                      <button type="button" className="relationship-primary-action" disabled={saving || !projectId} onClick={() => void addQaProject()}>Confirmar projeto</button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          </div>
        ) : (
          <BusinessUserManagementPanel
            person={person}
            onChanged={refreshPersonAndSearch}
            onMessage={showMessage}
          />
        ) : null}
      </Row>
    );
  }

  function renderCompany(item: Extract<ResultItem, { kind: "company" }>) {
    const assignments = data.assignments.filter((assignment) => assignment.company.id === item.id);
    const leaders = assignments.filter((assignment) => assignment.role === "leader_tc");
    const qaUsers = assignments.filter((assignment) => assignment.role === "qa_tc");
    const projects = Array.from(new Set(assignments.map((assignment) => assignment.project.id)));
    const open = selected?.kind === "company" && selected.id === item.id;

    return (
      <Row
        key={item.id}
        icon={<FiHome />}
        title={companyName(item.company)}
        subtitle={`${projects.length} projetos · ${leaders.length} líderes · ${qaUsers.length} usuários TC`}
        badge="Empresa"
        open={open}
        onClick={() => setSelected(open ? null : { kind: "company", id: item.id })}
      >
        <div className="relationship-company-context">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Liderança e equipe por projeto</p>
          {assignments.length ? assignments.map((assignment) => (
            <div key={assignment.id} className="relationship-link-line">
              <FiUsers />
              <div className="flex-1">
                <p className="font-bold">{personName(assignment.user)}</p>
                <p className="text-xs" style={{ color: "var(--rel-muted)" }}>{assignment.project.name} · {assignment.role === "leader_tc" ? "Líder TC" : "Usuário TC"}</p>
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
          <p className="relationship-eyebrow">BRAIN · CONTEXTO SEGURO</p>
          <h1 className="mt-1 text-3xl font-black sm:text-4xl">Gestão de Vínculos</h1>
          <p className="mx-auto mt-1 max-w-2xl text-sm" style={{ color: "var(--rel-muted)" }}>Escolha o tipo de vínculo e pesquise dentro do contexto autorizado.</p>
        </header>

        <div className="relationship-mode-tabs" role="tablist" aria-label="Tipos de vínculo">
          {allowedModes.map((itemMode) => (
            <button key={itemMode} type="button" role="tab" aria-selected={mode === itemMode} data-active={mode === itemMode} onClick={() => { setMode(itemMode); setSelected(null); setPerson(null); setAddOpen(false); }}>
              {MODE_ICON[itemMode]} <span>{MODE_LABEL[itemMode]}</span>
            </button>
          ))}
        </div>

        <form className="relationship-search relationship-search-simple" onSubmit={(event) => { event.preventDefault(); void search(query.trim(), mode); }}>
          <div className="relationship-search-field">
            <FiSearch />
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
            <span className="relationship-count-badge">{results.length}</span>
          </div>
          <div className="relationship-results-scroll">
            {!loading && query.trim().length > 0 && query.trim().length < MIN_SEARCH_LENGTH ? <div className="relationship-empty-state">Digite pelo menos três caracteres.</div> : null}
            {!loading && !(query.trim().length > 0 && query.trim().length < MIN_SEARCH_LENGTH) && results.length === 0 ? <div className="relationship-empty-state">Nenhum resultado disponível neste contexto.</div> : null}
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
          <aside className="relationship-history-panel" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-black uppercase tracking-[0.18em]">Histórico</p><h2 className="mt-1 text-xl font-black">Alterações de vínculo</h2></div>
              <button type="button" onClick={() => setHistoryOpen(false)}><FiX /></button>
            </div>
            <div className="mt-6 divide-y" style={{ borderColor: "var(--rel-line)" }}>
              {historyAssignments.length === 0 ? <p className="py-8 text-sm" style={{ color: "var(--rel-muted)" }}>Selecione uma pessoa para visualizar o histórico.</p> : historyAssignments.map((assignment) => (
                <div key={assignment.id} className="py-4">
                  <p className="font-bold">{assignment.project.name}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--rel-muted)" }}>{companyName(assignment.company)}</p>
                  <p className="mt-2 text-xs" style={{ color: "var(--rel-muted)" }}>{assignment.removalReason || "Sem justificativa registrada"}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : null}

      {removeTarget ? (
        <div className="fixed inset-0 z-[115] grid place-items-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="relationship-dialog">
            <div className="flex items-center justify-between"><h2 className="text-xl font-black">Remover vínculo</h2><button type="button" onClick={() => setRemoveTarget(null)}><FiX /></button></div>
            <p className="mt-2 text-sm" style={{ color: "var(--rel-muted)" }}>{removeTarget.project.name} · {companyName(removeTarget.company)}</p>
            <textarea value={removeReason} onChange={(event) => setRemoveReason(event.target.value)} placeholder="Informe a justificativa" />
            <div className="mt-4 flex justify-end gap-3"><button type="button" onClick={() => setRemoveTarget(null)}>Cancelar</button><button type="button" onClick={() => void removeQaProject()} disabled={saving} className="relationship-danger-action">Confirmar remoção</button></div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
