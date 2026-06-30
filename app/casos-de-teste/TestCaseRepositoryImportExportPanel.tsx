"use client";

import { useMemo, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiDatabase,
  FiDownload,
  FiFileText,
  FiGrid,
  FiInfo,
  FiUploadCloud,
} from "react-icons/fi";
import { fetchApi } from "@/lib/api";
import { useClientContext } from "@/context/ClientContext";
import { useProjectContext } from "@/lib/core/project/ProjectContext";

type TestCaseStep = {
  action: string;
  expectedResult: string;
  data?: string | null;
  notes?: string | null;
};

type ImportCasePayload = {
  title: string;
  description?: string;
  objective?: string;
  preconditions?: string;
  postconditions?: string;
  source?: string;
  type?: string;
  status?: string;
  priority?: string;
  severity?: string;
  risk?: string;
  companySlug?: string | null;
  companyId?: string | null;
  projectId?: string | null;
  applicationId?: string | null;
  moduleId?: string | null;
  testProjectCode?: string | null;
  testProjectName?: string | null;
  suiteId?: string | null;
  suiteName?: string | null;
  featureId?: string | null;
  tags?: string[];
  steps?: TestCaseStep[];
};

type TestCaseRecord = {
  testCase: {
    key?: string | null;
    title: string;
    description?: string | null;
    objective?: string | null;
    preconditions?: string | null;
    postconditions?: string | null;
    source?: string | null;
    type?: string | null;
    status?: string | null;
    priority?: string | null;
    severity?: string | null;
    risk?: string | null;
    companyId?: string | null;
    projectId?: string | null;
    applicationId?: string | null;
    moduleId?: string | null;
    testProjectCode?: string | null;
    testProjectName?: string | null;
    suiteId?: string | null;
    suiteName?: string | null;
    featureId?: string | null;
    tags?: string[];
    automationStatus?: string | null;
    externalUrl?: string | null;
  };
  steps?: Array<{
    order: number;
    action: string;
    expectedResult: string;
    data?: string | null;
    notes?: string | null;
  }>;
};

type ExportFormat = "pdf" | "csv" | "json" | "excel";

type ImportResult = {
  created?: number;
  failed?: number;
  total?: number;
  errors?: Array<{ index: number; title?: string; message: string }>;
};

const TEMPLATE_COLUMNS = [
  "title",
  "description",
  "objective",
  "preconditions",
  "postconditions",
  "source",
  "type",
  "status",
  "priority",
  "severity",
  "risk",
  "companySlug",
  "applicationId",
  "moduleId",
  "testProjectCode",
  "testProjectName",
  "suiteId",
  "suiteName",
  "featureId",
  "tags",
  "stepAction",
  "stepExpectedResult",
  "stepData",
  "stepNotes",
  "steps",
] as const;

const FIELD_GUIDE = [
  { name: "title", label: "Título", required: true, note: "Nome do caso, equivalente ao título no Qase." },
  { name: "description", label: "Descrição", required: false, note: "Resumo funcional do cenário." },
  { name: "objective", label: "Objetivo", required: false, note: "O que o caso comprova." },
  { name: "preconditions", label: "Pré-condições", required: false, note: "Estado necessário antes da execução." },
  { name: "postconditions", label: "Pós-condições", required: false, note: "Estado esperado após a execução." },
  { name: "priority", label: "Prioridade", required: false, note: "low, medium, high ou critical." },
  { name: "status", label: "Status", required: false, note: "draft, active, review, obsolete ou archived." },
  { name: "type", label: "Tipo", required: false, note: "manual, automated ou hybrid." },
  { name: "testProjectCode", label: "Projeto Qase", required: false, note: "Código do projeto, ex.: SFQ." },
  { name: "suiteName", label: "Suite/Pasta", required: false, note: "Agrupamento do caso." },
  { name: "tags", label: "Tags", required: false, note: "Separadas por vírgula ou ponto e vírgula." },
  { name: "steps", label: "Passos", required: false, note: "JSON ou use stepAction/stepExpectedResult." },
];

const SAMPLE_ROWS = [
  {
    title: "Validar login com credenciais válidas",
    description: "Usuário acessa o sistema com login e senha corretos.",
    objective: "Garantir acesso autenticado.",
    preconditions: "Usuário ativo e cadastrado.",
    postconditions: "Dashboard exibido.",
    source: "import",
    type: "manual",
    status: "active",
    priority: "high",
    severity: "high",
    risk: "medium",
    companySlug: "testing-company",
    applicationId: "quality-control",
    moduleId: "login",
    testProjectCode: "SFQ",
    testProjectName: "Quality Control",
    suiteId: "auth",
    suiteName: "Autenticação",
    featureId: "login",
    tags: "login, regressao, smoke",
    stepAction: "Informar login e senha válidos; clicar em Entrar",
    stepExpectedResult: "Sistema deve autenticar e abrir o dashboard",
    stepData: "usuario=qa@teste.com",
    stepNotes: "Modelo compatível com importação manual",
    steps: "",
  },
];

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function splitTags(value: unknown) {
  return normalizeText(value)
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseSteps(row: Record<string, unknown>): TestCaseStep[] {
  const rawSteps = normalizeText(row.steps || row.Steps || row.passos || row.Passos);
  if (rawSteps) {
    try {
      const parsed = JSON.parse(rawSteps) as Array<Record<string, unknown>>;
      if (Array.isArray(parsed)) {
        return parsed
          .map((step) => ({
            action: normalizeText(step.action ?? step.acao ?? step.step),
            expectedResult: normalizeText(step.expectedResult ?? step.expected ?? step.resultadoEsperado),
            data: normalizeText(step.data ?? step.dados) || undefined,
            notes: normalizeText(step.notes ?? step.observacoes) || undefined,
          }))
          .filter((step) => step.action && step.expectedResult);
      }
    } catch {
      return rawSteps
        .split(/\n+/)
        .map((line) => {
          const [action, expectedResult] = line.split(/=>|→|\|/).map((part) => part?.trim());
          return { action: action || line.trim(), expectedResult: expectedResult || "Resultado esperado não informado" };
        })
        .filter((step) => step.action);
    }
  }

  const action = normalizeText(row.stepAction ?? row.action ?? row.acao ?? row["Step Action"]);
  const expectedResult = normalizeText(row.stepExpectedResult ?? row.expectedResult ?? row.resultadoEsperado ?? row["Expected Result"]);
  if (!action && !expectedResult) return [];
  return [
    {
      action: action || "Ação não informada",
      expectedResult: expectedResult || "Resultado esperado não informado",
      data: normalizeText(row.stepData ?? row.data) || undefined,
      notes: normalizeText(row.stepNotes ?? row.notes) || undefined,
    },
  ];
}

function normalizeImportRows(rows: Array<Record<string, unknown>>, context: { companySlug: string | null; projectId: string | null; projectCode: string | null; projectName: string | null }) {
  return rows
    .map((row) => {
      const title = normalizeText(row.title ?? row.Título ?? row.titulo ?? row.name ?? row.Nome);
      const companySlug = normalizeText(row.companySlug ?? row.companyId ?? row.Empresa) || context.companySlug || null;
      return {
        title,
        description: normalizeText(row.description ?? row.Descrição ?? row.descricao),
        objective: normalizeText(row.objective ?? row.Objetivo),
        preconditions: normalizeText(row.preconditions ?? row["Pré-condições"] ?? row.preCondicoes),
        postconditions: normalizeText(row.postconditions ?? row["Pós-condições"] ?? row.posCondicoes),
        source: normalizeText(row.source ?? row.Origem) || "import",
        type: normalizeText(row.type ?? row.Tipo) || "manual",
        status: normalizeText(row.status ?? row.Status) || "active",
        priority: normalizeText(row.priority ?? row.Prioridade) || "medium",
        severity: normalizeText(row.severity ?? row.Severidade) || undefined,
        risk: normalizeText(row.risk ?? row.Risco) || undefined,
        companySlug,
        companyId: companySlug,
        projectId: normalizeText(row.projectId) || context.projectId || undefined,
        applicationId: normalizeText(row.applicationId ?? row.application ?? row.aplicacao ?? row.Aplicação) || undefined,
        moduleId: normalizeText(row.moduleId ?? row.module ?? row.modulo ?? row.Módulo) || undefined,
        testProjectCode: normalizeText(row.testProjectCode ?? row.projectCode ?? row.qaseProject ?? row.Projeto) || context.projectCode || undefined,
        testProjectName: normalizeText(row.testProjectName ?? row.projectName ?? row.NomeProjeto) || context.projectName || undefined,
        suiteId: normalizeText(row.suiteId ?? row.folderId) || undefined,
        suiteName: normalizeText(row.suiteName ?? row.suite ?? row.folder ?? row.Pasta) || undefined,
        featureId: normalizeText(row.featureId ?? row.feature ?? row.Funcionalidade) || undefined,
        tags: Array.isArray(row.tags) ? row.tags.map((tag) => normalizeText(tag)).filter(Boolean) : splitTags(row.tags ?? row.Tags),
        steps: parseSteps(row),
      } satisfies ImportCasePayload;
    })
    .filter((item) => item.title);
}

function flattenCase(record: TestCaseRecord) {
  const testCase = record.testCase;
  const firstStep = record.steps?.[0];
  return {
    key: testCase.key ?? "",
    title: testCase.title,
    description: testCase.description ?? "",
    objective: testCase.objective ?? "",
    preconditions: testCase.preconditions ?? "",
    postconditions: testCase.postconditions ?? "",
    source: testCase.source ?? "manual",
    type: testCase.type ?? "manual",
    status: testCase.status ?? "draft",
    priority: testCase.priority ?? "medium",
    severity: testCase.severity ?? "",
    risk: testCase.risk ?? "",
    companySlug: testCase.companyId ?? "",
    projectId: testCase.projectId ?? "",
    applicationId: testCase.applicationId ?? "",
    moduleId: testCase.moduleId ?? "",
    testProjectCode: testCase.testProjectCode ?? "",
    testProjectName: testCase.testProjectName ?? "",
    suiteId: testCase.suiteId ?? "",
    suiteName: testCase.suiteName ?? "",
    featureId: testCase.featureId ?? "",
    tags: (testCase.tags ?? []).join(", "),
    automationStatus: testCase.automationStatus ?? "none",
    externalUrl: testCase.externalUrl ?? "",
    stepAction: firstStep?.action ?? "",
    stepExpectedResult: firstStep?.expectedResult ?? "",
    stepData: firstStep?.data ?? "",
    stepNotes: firstStep?.notes ?? "",
    steps: JSON.stringify(
      (record.steps ?? []).map((step) => ({
        action: step.action,
        expectedResult: step.expectedResult,
        data: step.data ?? undefined,
        notes: step.notes ?? undefined,
      })),
    ),
  };
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportFilename(format: ExportFormat, projectSlug?: string | null) {
  const suffix = projectSlug ? normalizeSlug(projectSlug) : "repositorio-casos";
  const date = new Date().toISOString().slice(0, 10);
  const extension = format === "excel" ? "xlsx" : format;
  return `${suffix}-casos-${date}.${extension}`;
}

export default function TestCaseRepositoryImportExportPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { activeClientSlug } = useClientContext();
  const { activeProject } = useProjectContext();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const context = useMemo(
    () => ({
      companySlug: activeClientSlug ?? null,
      projectId: activeProject?.id ?? null,
      projectCode: activeProject?.qaseProjectCode ?? activeProject?.slug ?? null,
      projectName: activeProject?.name ?? null,
    }),
    [activeClientSlug, activeProject],
  );

  async function loadCurrentCases() {
    const params = new URLSearchParams({ includeIntegrated: "true" });
    if (context.companySlug) params.set("companySlug", context.companySlug);
    if (context.projectId) params.set("projectId", context.projectId);
    if (context.projectCode) params.set("projectCode", context.projectCode);

    const response = await fetchApi(`/api/test-cases?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível carregar os casos para exportação.");
    const payload = (await response.json()) as { items?: TestCaseRecord[] };
    return payload.items ?? [];
  }

  async function handleExport(format: ExportFormat) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const records = await loadCurrentCases();
      const rows = records.map(flattenCase);
      const filename = exportFilename(format, activeProject?.slug ?? context.companySlug);

      if (format === "json") {
        downloadBlob(JSON.stringify(rows, null, 2), filename, "application/json;charset=utf-8");
      }

      if (format === "csv") {
        const Papa = await import("papaparse");
        downloadBlob(Papa.unparse(rows), filename, "text/csv;charset=utf-8");
      }

      if (format === "excel") {
        const XLSX = await import("xlsx");
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : SAMPLE_ROWS);
        XLSX.utils.book_append_sheet(workbook, worksheet, "Casos de Teste");
        const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
        downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      }

      if (format === "pdf") {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 40;
        let y = 52;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("Repositório de Casos de Teste", margin, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        y += 20;
        doc.text(`Empresa: ${context.companySlug ?? "Todas"} | Projeto: ${context.projectName ?? context.projectCode ?? "Todos"}`, margin, y);
        y += 24;
        records.forEach((record, index) => {
          if (y > 740) {
            doc.addPage();
            y = 48;
          }
          const testCase = record.testCase;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.text(`${index + 1}. ${testCase.key ?? ""} ${testCase.title}`, margin, y, { maxWidth: pageWidth - margin * 2 });
          y += 16;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.text(`Status: ${testCase.status ?? "-"} | Prioridade: ${testCase.priority ?? "-"} | Projeto: ${testCase.testProjectCode ?? "-"} | Suite: ${testCase.suiteName ?? "-"}`, margin, y, { maxWidth: pageWidth - margin * 2 });
          y += 14;
          const description = testCase.description || testCase.objective || "Sem descrição.";
          const lines = doc.splitTextToSize(description, pageWidth - margin * 2) as string[];
          doc.text(lines.slice(0, 3), margin, y);
          y += Math.min(lines.length, 3) * 11 + 10;
        });
        doc.save(filename);
      }

      setMessage(`${rows.length} caso(s) exportado(s) em ${format.toUpperCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao exportar casos.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadTemplate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(SAMPLE_ROWS, { header: [...TEMPLATE_COLUMNS] });
      XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo Qase Opcional");
      const guide = XLSX.utils.json_to_sheet(FIELD_GUIDE);
      XLSX.utils.book_append_sheet(workbook, guide, "Campos");
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
      downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "modelo-importacao-casos-qase-opcional.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      setMessage("Modelo Excel baixado com os campos disponíveis no sistema.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar modelo.");
    } finally {
      setBusy(false);
    }
  }

  async function parseImportFile(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "json") {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
    }

    if (extension === "csv") {
      const Papa = await import("papaparse");
      const text = await file.text();
      const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
      return parsed.data;
    }

    if (extension === "xlsx" || extension === "xls") {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
    }

    throw new Error("Formato não suportado. Use JSON, CSV ou Excel (.xlsx/.xls). ");
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const rawRows = await parseImportFile(file);
      const cases = normalizeImportRows(rawRows, context);
      if (!cases.length) throw new Error("Nenhum caso válido encontrado. O campo title/título é obrigatório.");
      const response = await fetchApi("/api/test-cases/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cases, sourceFileName: file.name }),
      });
      const result = (await response.json().catch(() => null)) as ImportResult | null;
      if (!response.ok) throw new Error(result?.errors?.[0]?.message || "Falha ao importar casos.");
      const details = result?.failed ? ` ${result.failed} falharam.` : "";
      setMessage(`${result?.created ?? cases.length} caso(s) importado(s) para o sistema.${details}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar arquivo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-5 overflow-hidden rounded-[32px] border border-(--tc-border,#d7deea) bg-white shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18)_0%,transparent_30%),linear-gradient(135deg,#011848_0%,#123170_54%,#ef0001_135%)] px-5 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[0.26em] text-white/62">Importação e exportação</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">Casos no padrão do sistema, com referência Qase opcional</h2>
            <p className="mt-2 text-sm leading-6 text-white/78">
              Importe casos para o banco do Quality Control ou exporte o repositório em PDF, CSV, JSON e Excel. O código do projeto Qase é opcional e serve apenas como vínculo de rastreabilidade.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleDownloadTemplate} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/20 bg-white/12 px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/18 disabled:opacity-60">
              <FiFileText className="h-4 w-4" /> Modelo
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-[#011848] transition hover:bg-white/90 disabled:opacity-60">
              <FiUploadCloud className="h-4 w-4" /> Importar
            </button>
          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".json,.csv,.xlsx,.xls" className="hidden" onChange={(event) => void handleFileSelected(event)} />

      <div className="grid gap-4 p-5 lg:grid-cols-[1.1fr_0.9fr] sm:p-6">
        <div className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-(--tc-primary,#011848) shadow-sm">
              <FiDatabase className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-(--tc-text,#0b1a3c)">Escopo da operação</h3>
              <p className="mt-1 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">
                Empresa: <strong>{context.companySlug ?? "sem empresa selecionada"}</strong> · Projeto: <strong>{context.projectName ?? context.projectCode ?? "todos"}</strong>
              </p>
              <p className="mt-1 text-xs font-semibold text-(--tc-text-muted,#64748b)">
                Para importar direto no projeto certo, selecione a empresa e o projeto antes de importar.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {([
              ["pdf", "PDF", FiFileText],
              ["csv", "CSV", FiGrid],
              ["json", "JSON", FiDatabase],
              ["excel", "Excel", FiDownload],
            ] as Array<[ExportFormat, string, typeof FiDownload]>).map(([format, label, Icon]) => (
              <button
                key={format}
                type="button"
                onClick={() => void handleExport(format)}
                disabled={busy}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-3 text-xs font-black uppercase tracking-[0.1em] text-(--tc-text,#0b1a3c) transition hover:border-(--tc-primary,#011848) hover:shadow-sm disabled:opacity-60"
              >
                <Icon className="h-4 w-4 text-(--tc-accent,#ef0001)" /> {label}
              </button>
            ))}
          </div>

          {message ? (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> {message}
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-(--tc-border,#d7deea) bg-white p-4">
          <div className="flex items-center gap-2">
            <FiInfo className="h-4 w-4 text-(--tc-accent,#ef0001)" />
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-(--tc-text,#0b1a3c)">Campos disponíveis</h3>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {FIELD_GUIDE.slice(0, 8).map((field) => (
              <div key={field.name} className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 py-2">
                <div className="text-xs font-black text-(--tc-text,#0b1a3c)">{field.label}{field.required ? " *" : ""}</div>
                <div className="mt-0.5 text-[11px] leading-4 text-(--tc-text-muted,#64748b)">{field.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
