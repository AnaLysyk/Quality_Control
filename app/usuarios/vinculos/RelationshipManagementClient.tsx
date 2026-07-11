"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiArrowRight,
  FiBriefcase,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiFolder,
  FiHome,
  FiLink2,
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
  memberships?: Array<{ companyId: string; role?: string | null; allowedProjectIds?: string[]; company: Company }>;
  projectTeamAssignments?: Assignment[];
};
type SearchMode = "all" | "people" | "companies" | "projects" | "profiles";
type SelectedKind = "person" | "company" | "project" | "profile";
type Selected = { kind: SelectedKind; id: string } | null;
type UniversalSearchResponse = {
  companies: Company[];
  projects: Project[];
  people: Person[];
  assignments: Assignment[];
  profiles: Array<{ role: string; count: number }>;
  permissions: { canCreate: boolean; canEdit: boolean; canDelete: boolean };
};
type BaseResponse = { companies: Company[]; projects: Project[]; permissions: { canManage: boolean } };

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

const personName = (person: Person) => person.full_name || person.name || person.user || person.email;
const companyName = (company?: Company | null) => company?.company_name || company?.name || "Empresa";
const roleLabel = (role?: string | null) => ROLE_LABEL[String(role ?? "user")] ?? String(role ?? "Usuário").replaceAll("_", " ");

function BrainVisual({ busy }: { busy: boolean }) {
  return (
    <div className="relative mx-auto h-[190px] w-[190px] sm:h-[230px] sm:w-[230px]">
      <div className="brain-orb-wrap !h-full !w-full" aria-label="BRAIN visual" />
      <span className={`absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-[0.42em] text-slate-500 dark:text-slate-300 ${busy ? "animate-pulse" : ""}`}>BRAIN</span>
    </div>
  );
}

function Row({ icon, title, subtitle, open, onClick, children }: { icon: React.ReactNode; title: string; subtitle: string; open: boolean; onClick: () => void; children?: React.ReactNode }) {
  return (
    <div>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-4 py-5 text-left transition hover:bg-cyan-500/[0.035]">
        <span className="text-cyan-600 dark:text-cyan-300">{icon}</span>
        <span className="min-w-0 flex-1"><span className="block truncate font-black">{title}</span><span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</span></span>
        {open ? <FiChevronUp /> : <FiChevronDown />}
      </button>
      {open ? <div className="pb-6 pl-9 pr-2">{children}</div> : null}
    </div>
  );
}

export default function RelationshipManagementClient() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("all");
  const [data, setData] = useState<UniversalSearchResponse>(EMPTY_SEARCH);
  const [base, setBase] = useState<BaseResponse>({ companies: [], projects: [], permissions: { canManage: false } });
  const [selected, setSelected] = useState<Selected>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assignmentRole, setAssignmentRole] = useState<"leader_tc" | "qa_tc">("qa_tc");
  const [removeTarget, setRemoveTarget] = useState<Assignment | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const availableProjects = useMemo(() => base.projects.filter((project) => !companyId || project.companyId === companyId), [base.projects, companyId]);
  const activeAssignments = person?.projectTeamAssignments?.filter((item) => item.status === "active") ?? [];
  const historyAssignments = person?.projectTeamAssignments?.filter((item) => item.status !== "active") ?? [];
  const resultCount = data.people.length + data.companies.length + data.projects.length + data.profiles.length;

  useEffect(() => { void loadBase(); }, []);
  useEffect(() => { if (!message) return; const timer = window.setTimeout(() => setMessage(null), 5000); return () => window.clearTimeout(timer); }, [message]);

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

  async function search() {
    if (query.trim().length < 2) { setMessage({ type: "error", text: "Digite pelo menos dois caracteres." }); return; }
    setLoading(true); setSelected(null); setPerson(null);
    try {
      const params = new URLSearchParams({ q: query.trim(), mode });
      const response = await fetch(`/api/usuarios/vinculos/search?${params.toString()}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao pesquisar vínculos");
      setData(body);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao pesquisar vínculos" });
    } finally { setLoading(false); }
  }

  async function openPerson(id: string) {
    setLoading(true); setSelected({ kind: "person", id });
    try {
      const response = await fetch(`/api/usuarios/vinculos?personId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao carregar pessoa");
      setPerson(body.person);
      setCompanyId(body.person.memberships?.[0]?.companyId || body.person.projectTeamAssignments?.[0]?.company?.id || base.companies[0]?.id || "");
      setProjectId("");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao carregar pessoa" });
    } finally { setLoading(false); }
  }

  function toggle(kind: SelectedKind, id: string) {
    setSelected((current) => current?.kind === kind && current.id === id ? null : { kind, id });
    setPerson(null);
  }

  async function createAssignment() {
    if (!person || !companyId || !projectId) { setMessage({ type: "error", text: "Selecione pessoa, empresa e projeto." }); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/usuarios/vinculos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: person.id, companyId, projectId, role: assignmentRole }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao criar vínculo");
      setMessage({ type: "success", text: `BRAIN confirmou: vínculo de ${roleLabel(assignmentRole)} criado.` });
      await openPerson(person.id); await search();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao criar vínculo" });
    } finally { setSaving(false); }
  }

  async function removeAssignment() {
    if (!removeTarget || !removeReason.trim()) { setMessage({ type: "error", text: "Informe a justificativa da remoção." }); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/usuarios/vinculos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignmentId: removeTarget.id, reason: removeReason.trim() }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao remover vínculo");
      setMessage({ type: "success", text: "BRAIN confirmou: vínculo removido e histórico preservado." });
      setRemoveTarget(null); setRemoveReason(""); if (person) await openPerson(person.id); await search();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao remover vínculo" });
    } finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,.08),transparent_30%),linear-gradient(180deg,#fff,#f7faff)] px-4 pb-28 pt-5 text-slate-950 dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,.10),transparent_28%),linear-gradient(180deg,#020617,#07111f)] dark:text-white sm:px-7 lg:px-10">
      {message ? <div className={`fixed bottom-7 left-1/2 z-[120] flex w-[min(620px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${message.type === "success" ? "border-emerald-300/40 bg-emerald-50/95 text-emerald-950 dark:bg-emerald-950/90 dark:text-emerald-50" : "border-rose-300/40 bg-rose-50/95 text-rose-950 dark:bg-rose-950/90 dark:text-rose-50"}`}>{message.type === "success" ? <FiCheckCircle /> : <FiX />}<p className="flex-1 text-sm font-bold">{message.text}</p><button type="button" onClick={() => setMessage(null)}><FiX /></button></div> : null}

      <section className="mx-auto max-w-6xl">
        <div className="relative text-center">
          <button type="button" onClick={() => setHistoryOpen(true)} className="absolute right-0 top-2 grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/5" title="Histórico"><FiClock /></button>
          <BrainVisual busy={loading || saving} />
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-700/70 dark:text-cyan-200/70">Contexto seguro</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Gestão de Vínculos</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Pesquise pessoas, empresas, projetos ou perfis e gerencie os vínculos permitidos.</p>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void search(); }} className="mx-auto mt-7 flex max-w-5xl flex-col gap-2 rounded-[1.7rem] border border-slate-200 bg-white/85 p-2 shadow-[0_18px_55px_rgba(15,23,42,.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70 sm:flex-row">
          <select value={mode} onChange={(event) => setMode(event.target.value as SearchMode)} className="h-12 rounded-2xl bg-transparent px-4 text-sm font-bold outline-none sm:w-36"><option value="all">Todos</option><option value="people">Pessoas</option><option value="companies">Empresas</option><option value="projects">Projetos</option><option value="profiles">Perfis</option></select>
          <div className="flex flex-1 items-center gap-3 rounded-2xl bg-slate-100/80 px-4 dark:bg-white/[0.05]"><FiSearch className="text-cyan-600 dark:text-cyan-300" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, e-mail, empresa, projeto ou perfil..." className="h-12 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" /></div>
          <button type="submit" disabled={loading} className="h-12 rounded-2xl bg-slate-950 px-7 text-sm font-black text-white disabled:opacity-50 dark:bg-cyan-300 dark:text-slate-950">{loading ? "Buscando…" : "Buscar"}</button>
        </form>

        <div className="mt-8 border-y border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between py-4"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Resultados</p><h2 className="mt-1 text-lg font-black">{resultCount ? `${resultCount} encontrados` : "Comece pela busca"}</h2></div><span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-700 dark:text-cyan-200">{resultCount}</span></div>
          {!loading && query.trim().length < 2 ? <div className="flex min-h-[220px] flex-col items-center justify-center py-12 text-center"><FiLink2 className="h-9 w-9 text-cyan-500" /><p className="mt-4 text-sm font-bold text-slate-500">Digite pelo menos dois caracteres.</p></div> : null}
          {!loading && query.trim().length >= 2 && resultCount === 0 ? <div className="py-16 text-center text-sm font-semibold text-slate-500">Nenhum resultado encontrado.</div> : null}

          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {data.people.map((item) => {
              const open = selected?.kind === "person" && selected.id === item.id;
              return <Row key={`person:${item.id}`} icon={<FiUser />} title={personName(item)} subtitle={`${roleLabel(item.globalRole ?? item.role)} · ${item.email}`} open={open} onClick={() => void openPerson(item.id)}>{person ? <div className="grid gap-5 lg:grid-cols-2"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Vínculos atuais</p>{activeAssignments.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nenhum vínculo ativo.</p> : activeAssignments.map((assignment) => <div key={assignment.id} className="mt-3 flex items-center gap-3 border-b border-slate-200 pb-3 dark:border-white/10"><FiBriefcase /><div className="flex-1"><p className="font-bold">{assignment.project.name}</p><p className="text-xs text-slate-500">{companyName(assignment.company)} · {roleLabel(assignment.role)}</p></div>{data.permissions.canDelete && assignment.role !== "leader_tc" ? <button type="button" onClick={() => setRemoveTarget(assignment)} className="text-rose-500"><FiTrash2 /></button> : null}</div>)}</div><div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Criar vínculo</p><div className="mt-3 grid gap-3"><select value={companyId} onChange={(event) => setCompanyId(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-transparent px-3 text-sm font-bold dark:border-white/10"><option value="">Selecione a empresa</option>{base.companies.map((company) => <option key={company.id} value={company.id}>{companyName(company)}</option>)}</select><select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-transparent px-3 text-sm font-bold dark:border-white/10"><option value="">Selecione o projeto</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setAssignmentRole("leader_tc")} className={`h-10 rounded-xl border text-xs font-black ${assignmentRole === "leader_tc" ? "border-cyan-500 bg-cyan-500/10" : "border-slate-200 dark:border-white/10"}`}>Líder TC</button><button type="button" onClick={() => setAssignmentRole("qa_tc")} className={`h-10 rounded-xl border text-xs font-black ${assignmentRole === "qa_tc" ? "border-cyan-500 bg-cyan-500/10" : "border-slate-200 dark:border-white/10"}`}>Usuário TC</button></div><button type="button" onClick={() => void createAssignment()} disabled={saving || !projectId} className="h-11 rounded-xl bg-slate-950 text-sm font-black text-white disabled:opacity-40 dark:bg-cyan-300 dark:text-slate-950">Confirmar vínculo</button></div></div></div> : null}</Row>;
            })}

            {data.companies.map((company) => {
              const open = selected?.kind === "company" && selected.id === company.id;
              const assignments = data.assignments.filter((item) => item.company.id === company.id);
              return <Row key={`company:${company.id}`} icon={<FiHome />} title={companyName(company)} subtitle={`Empresa · ${assignments.length} vínculos encontrados`} open={open} onClick={() => toggle("company", company.id)}>{assignments.length ? assignments.map((assignment) => <p key={assignment.id} className="mt-2 text-sm font-bold">{assignment.user?.full_name || assignment.user?.name} · {assignment.project.name} · {roleLabel(assignment.role)}</p>) : <p className="text-sm text-slate-500">Nenhum vínculo localizado nesta busca.</p>}</Row>;
            })}

            {data.projects.map((project) => {
              const open = selected?.kind === "project" && selected.id === project.id;
              const assignments = data.assignments.filter((item) => item.project.id === project.id);
              const leader = assignments.find((item) => item.role === "leader_tc");
              return <Row key={`project:${project.id}`} icon={<FiFolder />} title={project.name} subtitle={`${companyName(project.company)} · Projeto`} open={open} onClick={() => toggle("project", project.id)}><div className="grid gap-3 md:grid-cols-2"><p className="text-sm font-bold">Líder: {leader?.user?.full_name || leader?.user?.name || "Não localizado"}</p><p className="text-sm font-bold">Usuários TC: {assignments.filter((item) => item.role === "qa_tc").length}</p></div></Row>;
            })}

            {data.profiles.map((profile) => {
              const open = selected?.kind === "profile" && selected.id === profile.role;
              const people = data.people.filter((item) => String(item.globalRole ?? item.role ?? "user") === profile.role);
              return <Row key={`profile:${profile.role}`} icon={<FiUsers />} title={roleLabel(profile.role)} subtitle={`Perfil · ${profile.count} pessoas`} open={open} onClick={() => toggle("profile", profile.role)}>{people.map((item) => <button key={item.id} type="button" onClick={() => void openPerson(item.id)} className="mr-3 mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-bold dark:border-white/10">{personName(item)} <FiArrowRight /></button>)}</Row>;
            })}
          </div>
        </div>
      </section>

      {historyOpen ? <div className="fixed inset-0 z-[110] bg-slate-950/35 backdrop-blur-sm" onClick={() => setHistoryOpen(false)}><aside className="absolute bottom-0 right-0 top-0 w-[min(430px,92vw)] overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-950" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Histórico</p><h2 className="mt-1 text-xl font-black">Alterações de vínculo</h2></div><button type="button" onClick={() => setHistoryOpen(false)}><FiX /></button></div><div className="mt-6 divide-y divide-slate-200 dark:divide-white/10">{historyAssignments.length === 0 ? <p className="py-8 text-sm text-slate-500">Selecione uma pessoa para visualizar o histórico.</p> : historyAssignments.map((assignment) => <div key={assignment.id} className="py-4"><p className="font-bold">{assignment.project.name}</p><p className="mt-1 text-xs text-slate-500">{companyName(assignment.company)} · {roleLabel(assignment.role)}</p><p className="mt-2 text-xs text-slate-500">{assignment.removalReason || "Sem justificativa registrada"}</p></div>)}</div></aside></div> : null}

      {removeTarget ? <div className="fixed inset-0 z-[115] grid place-items-center bg-slate-950/45 px-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-950"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Remover vínculo</h2><button type="button" onClick={() => setRemoveTarget(null)}><FiX /></button></div><p className="mt-2 text-sm text-slate-500">{removeTarget.project.name} · {companyName(removeTarget.company)}</p><textarea value={removeReason} onChange={(event) => setRemoveReason(event.target.value)} placeholder="Informe a justificativa" className="mt-5 min-h-28 w-full rounded-2xl border border-slate-200 bg-transparent p-4 text-sm outline-none dark:border-white/10" /><div className="mt-4 flex justify-end gap-3"><button type="button" onClick={() => setRemoveTarget(null)} className="rounded-xl px-4 py-2 text-sm font-bold">Cancelar</button><button type="button" onClick={() => void removeAssignment()} disabled={saving} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Confirmar remoção</button></div></div></div> : null}
    </main>
  );
}
