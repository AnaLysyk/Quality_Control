"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiArchive,
  FiCheckCircle,
  FiEdit2,
  FiFilter,
  FiLoader,
  FiPlus,
  FiRefreshCcw,
  FiSave,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { fetchApi } from "@/backend/api";

type TestCaseStep = {
  id?: string;
  order?: number;
  action: string;
  expectedResult: string;
  data?: string | null;
  notes?: string | null;
};

type TestCaseRecord = {
  testCase: {
    id: string;
    key: string;
    title: string;
    description?: string | null;
    objective?: string | null;
    preconditions?: string | null;
    postconditions?: string | null;
    source: string;
    type: string;
    status: string;
    priority: string;
    severity?: string | null;
    companyId?: string | null;
    applicationId?: string | null;
    moduleId?: string | null;
    testProjectCode?: string | null;
    suiteId?: string | null;
    suiteName?: string | null;
    tags: string[];
    automationStatus: string;
    createdAt: string;
    updatedAt: string;
  };
  steps: TestCaseStep[];
};

type Metrics = {
  total: number;
  automated: number;
  hybrid: number;
  manual: number;
  withoutAutomation: number;
  brokenAutomation: number;
  neverExecuted: number;
  failedRecently: number;
  automationCoverage: number;
};

type ApiResponse = {
  items?: TestCaseRecord[];
  total?: number;
  metrics?: Metrics;
  message?: string;
};

type FormState = {
  title: string;
  description: string;
  objective: string;
  preconditions: string;
  postconditions: string;
  applicationId: string;
  moduleId: string;
  testProjectCode: string;
  source: string;
  type: string;
  status: string;
  priority: string;
  automationStatus: string;
  tags: string;
  steps: Array<{ action: string; expectedResult: string; data: string; notes: string }>;
};

const EMPTY_STEP = { action: "", expectedResult: "", data: "", notes: "" };
const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  objective: "",
  preconditions: "",
  postconditions: "",
  applicationId: "",
  moduleId: "",
  testProjectCode: "",
  source: "manual",
  type: "manual",
  status: "draft",
  priority: "medium",
  automationStatus: "none",
  tags: "",
  steps: [{ ...EMPTY_STEP }],
};

const STATUS_OPTIONS = [
  ["draft", "Rascunho"],
  ["active", "Ativo"],
  ["review", "Revisão"],
  ["obsolete", "Obsoleto"],
  ["archived", "Arquivado"],
] as const;

const PRIORITY_OPTIONS = [
  ["low", "Baixa"],
  ["medium", "Média"],
  ["high", "Alta"],
  ["critical", "Crítica"],
] as const;

const SOURCE_OPTIONS = [
  ["manual", "Manual"],
  ["qase", "Qase"],
  ["automation", "Automação"],
  ["local", "Local"],
] as const;

const TYPE_OPTIONS = [
  ["manual", "Manual"],
  ["automated", "Automatizado"],
  ["hybrid", "Híbrido"],
] as const;

const AUTOMATION_OPTIONS = [
  ["none", "Sem automação"],
  ["planned", "Planejada"],
  ["linked", "Vinculada"],
  ["broken", "Quebrada"],
  ["disabled", "Desativada"],
] as const;

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function labelFromOptions(options: readonly (readonly [string, string])[], value: string | null | undefined) {
  return options.find(([key]) => key === value)?.[1] ?? value ?? "--";
}

function formatDate(value?: string | null) {
  if (!value) return "Sem data";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function buildFormFromRecord(record: TestCaseRecord): FormState {
  return {
    title: record.testCase.title,
    description: record.testCase.description ?? "",
    objective: record.testCase.objective ?? "",
    preconditions: record.testCase.preconditions ?? "",
    postconditions: record.testCase.postconditions ?? "",
    applicationId: record.testCase.applicationId ?? "",
    moduleId: record.testCase.moduleId ?? "",
    testProjectCode: record.testCase.testProjectCode ?? "",
    source: record.testCase.source || "manual",
    type: record.testCase.type || "manual",
    status: record.testCase.status || "draft",
    priority: record.testCase.priority || "medium",
    automationStatus: record.testCase.automationStatus || "none",
    tags: Array.isArray(record.testCase.tags) ? record.testCase.tags.join(", ") : "",
    steps: record.steps.length
      ? record.steps.map((step) => ({
          action: step.action ?? "",
          expectedResult: step.expectedResult ?? "",
          data: step.data ?? "",
          notes: step.notes ?? "",
        }))
      : [{ ...EMPTY_STEP }],
  };
}

function StatCard({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="rounded-3xl border border-white/12 bg-white/10 p-4 text-white shadow-[0_18px_38px_rgba(1,24,72,.12)]">
      <b className="block text-3xl leading-none tracking-[-.05em]">{value}</b>
      <span className="mt-2 block text-xs font-black uppercase tracking-[.16em] text-white/62">{label}</span>
      <p className="mt-2 text-xs font-semibold text-white/52">{note}</p>
    </div>
  );
}

export default function CompanyTestCasesRepositoryClient({ initialCompanySlug }: { initialCompanySlug: string }) {
  const companySlug = initialCompanySlug.trim().toLowerCase();
  const [items, setItems] = useState<TestCaseRecord[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [projectCode, setProjectCode] = useState("all");
  const [selected, setSelected] = useState<TestCaseRecord | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const loadCases = useCallback(async () => {
    if (!companySlug) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ companySlug });
    if (query.trim()) params.set("query", query.trim());
    if (status !== "all") params.set("status", status);
    if (source !== "all") params.set("source", source);
    if (projectCode !== "all") params.set("projectCode", projectCode);

    try {
      const response = await fetchApi(`/api/test-cases?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as ApiResponse | null;
      if (!response.ok) throw new Error(payload?.message || "Não foi possível carregar casos de teste.");
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      setItems(nextItems);
      setMetrics(payload?.metrics ?? null);
      setSelected((current) => current && nextItems.some((item) => item.testCase.id === current.testCase.id) ? current : nextItems[0] ?? null);
    } catch (cause) {
      setItems([]);
      setMetrics(null);
      setSelected(null);
      setError(cause instanceof Error ? cause.message : "Erro ao carregar casos de teste.");
    } finally {
      setLoading(false);
    }
  }, [companySlug, projectCode, query, source, status]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const projectOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        items
          .map((item) => item.testCase.testProjectCode)
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
      ),
    );
    return values.sort((left, right) => left.localeCompare(right));
  }, [items]);

  const applicationOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        items
          .map((item) => item.testCase.applicationId)
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
      ),
    );
    return values.sort((left, right) => left.localeCompare(right));
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = normalize(query);
    if (!term) return items;
    return items.filter((item) => {
      const content = [
        item.testCase.key,
        item.testCase.title,
        item.testCase.description,
        item.testCase.applicationId,
        item.testCase.testProjectCode,
        item.testCase.tags?.join(" "),
      ].filter(Boolean).join(" ");
      return normalize(content).includes(term);
    });
  }, [items, query]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, steps: [{ ...EMPTY_STEP }] });
    setError(null);
    setNotice(null);
    setFormOpen(true);
  }

  function openEdit(record: TestCaseRecord) {
    setEditingId(record.testCase.id);
    setForm(buildFormFromRecord(record));
    setError(null);
    setNotice(null);
    setFormOpen(true);
  }

  function updateStep(index: number, field: keyof FormState["steps"][number], value: string) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, [field]: value } : step),
    }));
  }

  function addStep() {
    setForm((current) => ({ ...current, steps: [...current.steps, { ...EMPTY_STEP }] }));
  }

  function removeStep(index: number) {
    setForm((current) => {
      const nextSteps = current.steps.filter((_, stepIndex) => stepIndex !== index);
      return { ...current, steps: nextSteps.length ? nextSteps : [{ ...EMPTY_STEP }] };
    });
  }

  async function handleSave() {
    const title = form.title.trim();
    if (!title) {
      setError("Título é obrigatório.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const payload = {
      title,
      description: form.description.trim(),
      objective: form.objective.trim(),
      preconditions: form.preconditions.trim(),
      postconditions: form.postconditions.trim(),
      companySlug,
      applicationId: form.applicationId.trim() || undefined,
      moduleId: form.moduleId.trim() || undefined,
      testProjectCode: form.testProjectCode.trim().toUpperCase() || undefined,
      source: form.source,
      type: form.type,
      status: form.status,
      priority: form.priority,
      automationStatus: form.automationStatus,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      steps: form.steps
        .map((step) => ({
          action: step.action.trim(),
          expectedResult: step.expectedResult.trim(),
          data: step.data.trim() || undefined,
          notes: step.notes.trim() || undefined,
        }))
        .filter((step) => step.action && step.expectedResult),
    };

    const endpoint = editingId ? `/api/test-cases/${encodeURIComponent(editingId)}` : "/api/test-cases";
    const method = editingId ? "PATCH" : "POST";

    try {
      const response = await fetchApi(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responsePayload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(responsePayload?.message || responsePayload?.error || "Não foi possível salvar o caso.");
      }
      setFormOpen(false);
      setEditingId(null);
      setNotice(editingId ? "Caso atualizado." : "Caso criado.");
      await loadCases();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao salvar caso.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(record: TestCaseRecord) {
    const confirmed = window.confirm(`Arquivar o caso "${record.testCase.title}"?`);
    if (!confirmed) return;
    setError(null);
    setNotice(null);
    try {
      const response = await fetchApi(`/api/test-cases/${encodeURIComponent(record.testCase.id)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || payload?.error || "Não foi possível arquivar o caso.");
      setNotice("Caso arquivado.");
      await loadCases();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao arquivar caso.");
    }
  }

  const total = metrics?.total ?? filteredItems.length;
  const coverage = metrics?.automationCoverage ?? 0;

  return (
    <div className="min-h-full text-[#011848] dark:text-white">
      <div className="flex flex-col gap-6 px-3 py-4 sm:px-4 lg:px-8">
        <section className="relative overflow-hidden rounded-[34px] border border-white/14 bg-[radial-gradient(circle_at_12%_8%,rgba(239,0,1,.34),transparent_28%),linear-gradient(135deg,#040814_0%,#07111f_54%,#0b1932_100%)] p-5 text-white shadow-[0_28px_90px_rgba(1,24,72,.28)] sm:p-6 lg:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-black uppercase tracking-[.16em] text-white/62">
                Empresa · {companySlug}
              </span>
              <h1 className="mt-4 text-4xl font-black leading-[.95] tracking-[-.06em] sm:text-5xl">Casos de Teste</h1>
              <p className="mt-3 max-w-3xl text-base font-semibold leading-relaxed text-white/68">
                Repositório de casos filtrado pela empresa, com criação, edição, arquivamento e vínculo ao projeto/código Qase.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void loadCases()} className="tc-button-secondary border-white/18 bg-white/10 text-white hover:bg-white/15">
                <FiRefreshCcw /> Atualizar
              </button>
              <button type="button" onClick={openCreate} className="tc-button-primary">
                <FiPlus /> Novo caso
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total" value={total} note="casos visíveis no escopo" />
            <StatCard label="Manuais" value={metrics?.manual ?? 0} note="casos manuais" />
            <StatCard label="Automatizados" value={metrics?.automated ?? 0} note="casos com automação" />
            <StatCard label="Cobertura" value={`${coverage}%`} note="automação do repositório" />
          </div>
        </section>

        <section className="rounded-[30px] border border-[var(--tc-border)] bg-white/78 p-4 shadow-[0_18px_46px_rgba(1,24,72,.08)] dark:bg-white/[0.035]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black tracking-[-.04em]">Filtros do repositório</h2>
              <p className="mt-1 text-sm text-[#64748b] dark:text-white/60">A busca e os filtros sempre respeitam a empresa da rota.</p>
            </div>
            <label className="w-full lg:max-w-md">
              <div className="flex w-full items-center gap-3 rounded-[20px] border border-[var(--tc-border)] bg-white/65 px-4 py-3 dark:bg-white/[0.04]">
                <FiSearch />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar caso, projeto, tag..." className="w-full bg-transparent text-sm outline-none" />
              </div>
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 text-sm dark:bg-[#07111f]">
              <option value="all">Status: todos</option>
              {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={source} onChange={(event) => setSource(event.target.value)} className="rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 text-sm dark:bg-[#07111f]">
              <option value="all">Origem: todas</option>
              {SOURCE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={projectCode} onChange={(event) => setProjectCode(event.target.value)} className="rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 text-sm dark:bg-[#07111f]">
              <option value="all">Projeto: todos</option>
              {projectOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <button type="button" onClick={() => { setQuery(""); setStatus("all"); setSource("all"); setProjectCode("all"); }} className="rounded-2xl border border-[var(--tc-border)] px-4 py-3 text-sm font-black">
              <FiFilter className="inline" /> Limpar filtros
            </button>
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-100">{error}</div> : null}
        {notice ? <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100">{notice}</div> : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-[30px] border border-[var(--tc-border)] bg-white/78 p-5 shadow-[0_18px_46px_rgba(1,24,72,.08)] dark:bg-white/[0.035]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-[-.05em]">Casos da empresa</h2>
                <p className="mt-1 text-sm text-[#64748b] dark:text-white/60">{filteredItems.length} registro(s) encontrados.</p>
              </div>
              {loading ? <FiLoader className="animate-spin text-[#64748b]" /> : null}
            </div>

            <div className="mt-5 grid gap-3">
              {filteredItems.map((record) => {
                const active = selected?.testCase.id === record.testCase.id;
                return (
                  <article key={record.testCase.id} className={`rounded-3xl border p-4 transition ${active ? "border-[rgba(239,0,1,.55)] bg-white shadow-[inset_5px_0_0_var(--tc-accent),0_18px_36px_rgba(1,24,72,.08)] dark:bg-white/[0.07]" : "border-[var(--tc-border)] bg-white/62 hover:bg-white dark:bg-white/[0.025] dark:hover:bg-white/[0.05]"}`}>
                    <button type="button" onClick={() => setSelected(record)} className="w-full text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[var(--tc-border)] px-2.5 py-1 text-[11px] font-black uppercase tracking-[.14em] text-[#64748b] dark:text-white/55">{record.testCase.key}</span>
                        <span className="rounded-full bg-[#eef3fb] px-2.5 py-1 text-xs font-bold text-[#64748b] dark:bg-white/10 dark:text-white/65">{labelFromOptions(STATUS_OPTIONS, record.testCase.status)}</span>
                        <span className="rounded-full bg-[#eef3fb] px-2.5 py-1 text-xs font-bold text-[#64748b] dark:bg-white/10 dark:text-white/65">{labelFromOptions(SOURCE_OPTIONS, record.testCase.source)}</span>
                      </div>
                      <h3 className="mt-3 text-lg font-black tracking-[-.03em]">{record.testCase.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-[#64748b] dark:text-white/60">{record.testCase.description || "Sem descrição."}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[#64748b] dark:text-white/50">
                        <span>Projeto: {record.testCase.testProjectCode || "--"}</span>
                        <span>Aplicação: {record.testCase.applicationId || "--"}</span>
                        <span>Passos: {record.steps.length}</span>
                        <span>Atualizado: {formatDate(record.testCase.updatedAt)}</span>
                      </div>
                    </button>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => openEdit(record)} className="rounded-xl border border-[var(--tc-border)] px-3 py-2 text-xs font-black"><FiEdit2 className="inline" /> Editar</button>
                      <button type="button" onClick={() => void handleArchive(record)} className="rounded-xl border border-[var(--tc-border)] px-3 py-2 text-xs font-black text-rose-600 dark:text-rose-200"><FiArchive className="inline" /> Arquivar</button>
                    </div>
                  </article>
                );
              })}

              {!loading && filteredItems.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[var(--tc-border)] p-8 text-center text-sm text-[#64748b] dark:text-white/60">
                  Nenhum caso encontrado para a empresa e filtros atuais.
                </div>
              ) : null}
            </div>
          </div>

          <aside className="rounded-[30px] border border-[var(--tc-border)] bg-white/78 p-5 shadow-[0_18px_46px_rgba(1,24,72,.08)] dark:bg-white/[0.035] xl:sticky xl:top-4 xl:self-start">
            <div className="flex items-center gap-2">
              <FiCheckCircle className="text-[var(--tc-accent)]" />
              <h2 className="text-xl font-black tracking-[-.04em]">Detalhe rápido</h2>
            </div>
            {selected ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.16em] text-[#64748b] dark:text-white/50">{selected.testCase.key}</p>
                  <h3 className="mt-1 text-lg font-black">{selected.testCase.title}</h3>
                  <p className="mt-2 text-sm text-[#64748b] dark:text-white/60">{selected.testCase.description || "Sem descrição."}</p>
                </div>
                <div className="grid gap-2 text-sm">
                  <p><b>Status:</b> {labelFromOptions(STATUS_OPTIONS, selected.testCase.status)}</p>
                  <p><b>Prioridade:</b> {labelFromOptions(PRIORITY_OPTIONS, selected.testCase.priority)}</p>
                  <p><b>Tipo:</b> {labelFromOptions(TYPE_OPTIONS, selected.testCase.type)}</p>
                  <p><b>Automação:</b> {labelFromOptions(AUTOMATION_OPTIONS, selected.testCase.automationStatus)}</p>
                  <p><b>Projeto:</b> {selected.testCase.testProjectCode || "--"}</p>
                </div>
                <div>
                  <p className="text-sm font-black">Passos</p>
                  <div className="mt-2 space-y-2">
                    {selected.steps.slice(0, 5).map((step, index) => (
                      <div key={`${selected.testCase.id}-step-${index}`} className="rounded-2xl border border-[var(--tc-border)] p-3 text-sm">
                        <b>Passo {index + 1}</b>
                        <p className="mt-1 text-[#64748b] dark:text-white/60">{step.action}</p>
                        <p className="mt-1 text-[#64748b] dark:text-white/60"><b>Esperado:</b> {step.expectedResult}</p>
                      </div>
                    ))}
                    {!selected.steps.length ? <p className="text-sm text-[#64748b] dark:text-white/60">Sem passos cadastrados.</p> : null}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#64748b] dark:text-white/60">Selecione um caso para ver o resumo.</p>
            )}
          </aside>
        </section>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[30px] border border-[var(--tc-border)] bg-white p-5 shadow-2xl dark:bg-[#07111f]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-[#64748b] dark:text-white/50">{editingId ? "Editar caso" : "Novo caso"}</p>
                <h2 className="mt-1 text-2xl font-black tracking-[-.05em]">Repositório da empresa</h2>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-full border border-[var(--tc-border)] p-2"><FiX /></button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <label className="lg:col-span-2 text-sm font-bold">Título
                <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="mt-1 w-full rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 dark:bg-[#0b1628]" />
              </label>
              <label className="lg:col-span-2 text-sm font-bold">Descrição
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="mt-1 w-full rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 dark:bg-[#0b1628]" />
              </label>
              <label className="text-sm font-bold">Aplicação
                <input list="company-test-case-apps" value={form.applicationId} onChange={(event) => setForm((current) => ({ ...current, applicationId: event.target.value }))} className="mt-1 w-full rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 dark:bg-[#0b1628]" />
              </label>
              <datalist id="company-test-case-apps">{applicationOptions.map((value) => <option key={value} value={value} />)}</datalist>
              <label className="text-sm font-bold">Projeto / Qase
                <input value={form.testProjectCode} onChange={(event) => setForm((current) => ({ ...current, testProjectCode: event.target.value }))} className="mt-1 w-full rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 uppercase dark:bg-[#0b1628]" />
              </label>
              <label className="text-sm font-bold">Status
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="mt-1 w-full rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 dark:bg-[#0b1628]">
                  {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold">Prioridade
                <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} className="mt-1 w-full rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 dark:bg-[#0b1628]">
                  {PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold">Origem
                <select value={form.source} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))} className="mt-1 w-full rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 dark:bg-[#0b1628]">
                  {SOURCE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold">Tipo
                <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} className="mt-1 w-full rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 dark:bg-[#0b1628]">
                  {TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold">Automação
                <select value={form.automationStatus} onChange={(event) => setForm((current) => ({ ...current, automationStatus: event.target.value }))} className="mt-1 w-full rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 dark:bg-[#0b1628]">
                  {AUTOMATION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold">Tags
                <input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="smoke, regressão" className="mt-1 w-full rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 dark:bg-[#0b1628]" />
              </label>
            </div>

            <div className="mt-5 rounded-3xl border border-[var(--tc-border)] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black">Passos</h3>
                <button type="button" onClick={addStep} className="rounded-xl border border-[var(--tc-border)] px-3 py-2 text-xs font-black"><FiPlus className="inline" /> Adicionar passo</button>
              </div>
              <div className="mt-4 space-y-3">
                {form.steps.map((step, index) => (
                  <div key={`draft-step-${index}`} className="rounded-2xl border border-[var(--tc-border)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <b>Passo {index + 1}</b>
                      <button type="button" onClick={() => removeStep(index)} className="text-xs font-bold text-rose-600 dark:text-rose-200">Remover</button>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <textarea value={step.action} onChange={(event) => updateStep(index, "action", event.target.value)} placeholder="Ação" rows={2} className="rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 text-sm dark:bg-[#0b1628]" />
                      <textarea value={step.expectedResult} onChange={(event) => updateStep(index, "expectedResult", event.target.value)} placeholder="Resultado esperado" rows={2} className="rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 text-sm dark:bg-[#0b1628]" />
                      <input value={step.data} onChange={(event) => updateStep(index, "data", event.target.value)} placeholder="Dados" className="rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 text-sm dark:bg-[#0b1628]" />
                      <input value={step.notes} onChange={(event) => updateStep(index, "notes", event.target.value)} placeholder="Observações" className="rounded-2xl border border-[var(--tc-border)] bg-white px-4 py-3 text-sm dark:bg-[#0b1628]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-2xl border border-[var(--tc-border)] px-4 py-3 text-sm font-black">Cancelar</button>
              <button type="button" onClick={() => void handleSave()} disabled={saving} className="tc-button-primary disabled:opacity-60">
                {saving ? <FiLoader className="animate-spin" /> : <FiSave />} Salvar caso
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
