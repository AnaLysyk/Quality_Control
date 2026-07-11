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

type Company = { id: string; name: string; company_name?: string | null; slug: string };
type Project = { id: string; companyId: string; name: string; slug: string; status: string; company?: Company };
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
  memberships?: Array<{ companyId: string; role?: string | null; company: Company }>;
  projectTeamAssignments?: Assignment[];
};
type SearchMode = "all" | "people" | "companies";
type ResultItem =
  | { kind: "person"; id: string; person: Person }
  | { kind: "company"; id: string; company: Company };
type SearchResponse = {
  companies: Company[];
  projects: Project[];
  people: Person[];
  assignments: Assignment[];
  profiles: Array<{ role: string; count: number }>;
  permissions: { canCreate: boolean; canEdit: boolean; canDelete: boolean };
};
type BaseResponse = { companies: Company[]; projects: Project[]; permissions: { canManage: boolean } };

const EMPTY_SEARCH: SearchResponse = {
  companies: [],
  projects: [],
  people: [],
  assignments: [],
  profiles: [],
  permissions: { canCreate: false, canEdit: false, canDelete: false },
};

const PAGE_SIZE = 5;
const MIN_SEARCH_LENGTH = 3;
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
  const relationFields = [
    roleLabel(item.person.globalRole ?? item.person.role),
    ...(item.person.memberships ?? []).map((link) => companyName(link.company)),
    ...(item.person.projectTeamAssignments ?? []).flatMap((link) => [companyName(link.company), link.project.name, roleLabel(link.role)]),
  ].map(normalize);

  if (names.some((field) => field === normalizedQuery) || emailLocal === normalizedQuery) return 140;
  if (names.some((field) => field.startsWith(normalizedQuery)) || emailLocal.startsWith(normalizedQuery)) return 120;
  if (names.some((field) => field.includes(normalizedQuery)) || emailLocal.includes(normalizedQuery)) return 95;
  if (relationFields.some((field) => field.startsWith(normalizedQuery))) return 70;
  if (relationFields.some((field) => field.includes(normalizedQuery))) return 55;
  return 10;
}

function BrainVisual({ busy }: { busy: boolean }) {
  return (
    <div className="relationship-brain" data-busy={busy} aria-label="BRAIN visual">
      <img src="/brain-orb-reference.svg" alt="BRAIN" />
    </div>
  );
}

function Row({ icon, title, subtitle, open, onClick, children }: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  open: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="relationship-row" data-open={open}>
      <button type="button" className="relationship-row-trigger" onClick={onClick}>
        <span className="text-cyan-600 dark:text-cyan-300">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-black">{title}</span>
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
  const [mode, setMode] = useState<SearchMode>("all");
  const [data, setData] = useState<SearchResponse>(EMPTY_SEARCH);
  const [base, setBase] = useState<BaseResponse>({ companies: [], projects: [], permissions: { canManage: false } });
  const [selected, setSelected] = useState<{ kind: ResultItem["kind"]; id: string } | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [page, setPage] = useState(1);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assignmentRole, setAssignmentRole] = useState<"leader_tc" | "qa_tc">("qa_tc");
  const [removeTarget, setRemoveTarget] = useState<Assignment | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const searchRequestRef = useRef<AbortController | null>(null);

  const results = useMemo<ResultItem[]>(() => {
    const merged: ResultItem[] = [
      ...data.people.map((item) => ({ kind: "person" as const, id: item.id, person: item })),
      ...data.companies.map((item) => ({ kind: "company" as const, id: item.id, company: item })),
    ];
    return merged.sort((left, right) => resultScore(right, query) - resultScore(left, query));
  }, [data, query]);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const visibleResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const availableProjects = useMemo(() => base.projects.filter((item) => !companyId || item.companyId === companyId), [base.projects, companyId]);
  const activeAssignments = person?.projectTeamAssignments?.filter((item) => item.status === "active") ?? [];
  const historyAssignments = person?.projectTeamAssignments?.filter((item) => item.status !== "active") ?? [];

  useEffect(() => { void loadBase(); }, []);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      searchRequestRef.current?.abort();
      setData(EMPTY_SEARCH);
      setSelected(null);
      setPerson(null);
      setAddFormOpen(false);
      setPage(1);
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(() => { void search(trimmed, mode); }, 420);
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
    if (searchQuery.length < MIN_SEARCH_LENGTH) return;
    searchRequestRef.current?.abort();
    const controller = new AbortController();
    searchRequestRef.current = controller;
    setLoading(true);
    setSelected(null);
    setPerson(null);
    setAddFormOpen(false);
    setPage(1);
    try {
      const params = new URLSearchParams({ q: searchQuery, mode: searchMode });
      const response = await fetch(`/api/usuarios/vinculos/search?${params.toString()}`, { cache: "no-store", signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao pesquisar vínculos");
      setData(body);
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

  function toggle(kind: ResultItem["kind"], id: string) {
    setSelected((current) => current?.kind === kind && current.id === id ? null : { kind, id });
    setPerson(null);
    setAddFormOpen(false);
  }

  async function createAssignment() {
    if (!person || !companyId || !projectId) {
      setMessage({ type: "error", text: "Selecione pessoa, empresa e projeto." });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/usuarios/vinculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: person.id, companyId, projectId, role: assignmentRole }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao criar vínculo");
      setMessage({ type: "success", text: `BRAIN confirmou: vínculo de ${roleLabel(assignmentRole)} criado.` });
      setAddFormOpen(false);
      await openPerson(person.id, true);
      await search();
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
      await search();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao remover vínculo" });
    } finally {
      setSaving(false);
    }
  }

  function renderResult(item: ResultItem) {
    if (item.kind === "person") {
      const open = selected?.kind === "person" && selected.id === item.id;
      const companyLinks = item.person.memberships ?? [];
      const projectLinks = item.person.projectTeamAssignments ?? [];
      const subtitleParts = [roleLabel(item.person.globalRole ?? item.person.role), item.person.email];
      if (companyLinks.length) subtitleParts.push(`${companyLinks.length} empresa${companyLinks.length === 1 ? "" : "s"}`);
      if (projectLinks.length) subtitleParts.push(`${projectLinks.length} projeto${projectLinks.length === 1 ? "" : "s"}`);

      return (
        <Row key={`person:${item.id}`} icon={<FiUser />} title={personName(item.person)} subtitle={subtitleParts.join(" · ")} open={open} onClick={() => void openPerson(item.id)}>
          {person ? (
            <div className="relationship-person-context">
              <section className="relationship-inline-section">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Empresas e projetos vinculados</p>
                {activeAssignments.length === 0 ? (
                  <p className="mt-3 text-sm" style={{ color: "var(--rel-muted)" }}>Nenhum vínculo de projeto ativo.</p>
                ) : activeAssignments.map((assignment) => (
                  <div key={assignment.id} className="relationship-link-line">
                    <FiBriefcase />
                    <div className="flex-1">
                      <p className="font-bold">{companyName(assignment.company)}</p>
                      <p className="text-xs" style={{ color: "var(--rel-muted)" }}>{assignment.project.name} · {roleLabel(assignment.role)}</p>
                    </div>
                    {data.permissions.canDelete && assignment.role !== "leader_tc" ? (
                      <button type="button" onClick={() => setRemoveTarget(assignment)} className="text-rose-500" title="Remover vínculo"><FiTrash2 /></button>
                    ) : null}
                  </div>
                ))}
              </section>

              <section className="relationship-inline-section">
                <button type="button" onClick={() => setAddFormOpen((current) => !current)} className="relationship-add-toggle">
                  {addFormOpen ? <FiMinus /> : <FiPlus />}
                  <span>{addFormOpen ? "Fechar inclusão" : "Adicionar vínculo"}</span>
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
                    <button type="button" onClick={() => setAssignmentRole("leader_tc")} className={`h-10 rounded-xl text-xs font-black ${assignmentRole === "leader_tc" ? "bg-cyan-500/10" : ""}`}>Líder TC</button>
                    <button type="button" onClick={() => setAssignmentRole("qa_tc")} className={`h-10 rounded-xl text-xs font-black ${assignmentRole === "qa_tc" ? "bg-cyan-500/10" : ""}`}>Usuário TC</button>
                    <button type="button" onClick={() => void createAssignment()} disabled={saving || !projectId} className="col-span-full h-10 rounded-xl bg-slate-950 text-xs font-black text-white disabled:opacity-40 dark:bg-cyan-300 dark:text-slate-950">Confirmar vínculo</button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs" style={{ color: "var(--rel-muted)" }}>Abra apenas quando precisar incluir uma nova empresa ou projeto.</p>
                )}
              </section>
            </div>
          ) : null}
        </Row>
      );
    }

    const assignments = data.assignments.filter((assignment) => assignment.company.id === item.id);
    const leaders = assignments.filter((assignment) => assignment.role === "leader_tc");
    const tcUsers = assignments.filter((assignment) => assignment.role === "qa_tc");
    const projectCount = new Set(assignments.map((assignment) => assignment.project.id)).size;

    return (
      <Row
        key={`company:${item.id}`}
        icon={<FiHome />}
        title={companyName(item.company)}
        subtitle={`Empresa · ${projectCount} projetos · ${leaders.length} líderes · ${tcUsers.length} usuários TC`}
        open={selected?.kind === "company" && selected.id === item.id}
        onClick={() => toggle("company", item.id)}
      >
        <div className="relationship-company-context">
          <section>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Liderança e equipe</p>
            {assignments.length ? assignments.map((assignment) => (
              <div key={assignment.id} className="relationship-link-line">
                <FiUsers />
                <div className="flex-1">
                  <p className="font-bold">{assignment.user?.full_name || assignment.user?.name}</p>
                  <p className="text-xs" style={{ color: "var(--rel-muted)" }}>{assignment.project.name} · {roleLabel(assignment.role)}</p>
                </div>
              </div>
            )) : <p className="mt-3 text-sm" style={{ color: "var(--rel-muted)" }}>Nenhum vínculo localizado para esta empresa.</p>}
          </section>
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
          <p className="mx-auto mt-1 max-w-2xl text-sm" style={{ color: "var(--rel-muted)" }}>Pesquise por pessoa, empresa, projeto ou perfil. Os resultados são organizados por pessoa ou empresa.</p>
        </header>

        <form className="relationship-search" onSubmit={(event) => { event.preventDefault(); void search(); }}>
          <select value={mode} onChange={(event) => setMode(event.target.value as SearchMode)}>
            <option value="all">Todos</option>
            <option value="people">Pessoas</option>
            <option value="companies">Empresas</option>
          </select>
          <div className="relationship-search-field">
            <FiSearch className="text-cyan-600 dark:text-cyan-300" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, e-mail, empresa, projeto ou perfil..." />
          </div>
          <button type="submit" disabled={loading || query.trim().length < MIN_SEARCH_LENGTH} className="relationship-search-submit">{loading ? "Buscando…" : "Buscar"}</button>
        </form>

        <section className="relationship-results">
          <div className="relationship-results-header">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Resultados</p>
              <h2 className="mt-1 text-lg font-black">{results.length ? `${results.length} encontrados` : "Comece pela busca"}</h2>
            </div>
            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-700 dark:text-cyan-200">{results.length}</span>
          </div>
          <div className="relationship-results-scroll">
            {!loading && query.trim().length < MIN_SEARCH_LENGTH ? <div className="flex h-full min-h-[150px] items-center justify-center text-sm font-bold" style={{ color: "var(--rel-muted)" }}>Digite pelo menos três caracteres para pesquisar automaticamente.</div> : null}
            {!loading && query.trim().length >= MIN_SEARCH_LENGTH && results.length === 0 ? <div className="flex h-full min-h-[150px] items-center justify-center text-sm font-bold" style={{ color: "var(--rel-muted)" }}>Nenhum resultado encontrado.</div> : null}
            {visibleResults.map(renderResult)}
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
