"use client";

import { type DragEvent, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiFlag,
  FiLink2,
  FiPaperclip,
  FiPlus,
  FiTag,
  FiUser,
  FiX,
} from "react-icons/fi";

export type RunCaseStatus = "notRun" | "inProgress" | "blocked" | "fail" | "pass";
export type RunCaseMode = "manual" | "integration";

export type RunCaseDraft = {
  id: string;
  title: string;
  link: string;
  status: RunCaseStatus;
  bug: string | null;
  fromApi?: boolean;
  origin?: string | null;
  type?: string | null;
  projectCode?: string | null;
  suiteId?: string | null;
  suiteName?: string | null;
  description?: string | null;
  preconditions?: string | null;
  postconditions?: string | null;
  stepsText?: string | null;
  expectedText?: string | null;
  priority?: string | null;
  severity?: string | null;
  tags?: string[];
  responsibleName?: string | null;
  defectsCount?: number;
  evidencesCount?: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  statusUpdatedAt?: string | null;
  retestCount?: number;
};

type CaseColumn = {
  key: RunCaseStatus;
  label: string;
  shortLabel: string;
  ringClass: string;
  chipClass: string;
  toneClass: string;
};

type RunCasesBoardProps = {
  cases: RunCaseDraft[];
  onCasesChange: (cases: RunCaseDraft[]) => void;
  editable?: boolean;
  mode?: RunCaseMode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
  showComposer?: boolean;
};

const CASE_COLUMNS: CaseColumn[] = [
  {
    key: "notRun",
    label: "Novo",
    shortLabel: "Novo",
    ringClass: "border-slate-300 dark:border-slate-600",
    chipClass:
      "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-600",
    toneClass: "from-slate-50 to-(--tc-surface) dark:from-slate-900/60 dark:to-(--tc-surface)",
  },
  {
    key: "inProgress",
    label: "Em andamento",
    shortLabel: "Andamento",
    ringClass: "border-blue-300 dark:border-blue-700",
    chipClass:
      "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-100 dark:border-blue-700",
    toneClass: "from-blue-50 to-(--tc-surface) dark:from-blue-950/60 dark:to-(--tc-surface)",
  },
  {
    key: "blocked",
    label: "Bloqueado",
    shortLabel: "Bloq.",
    ringClass: "border-amber-300 dark:border-amber-700",
    chipClass:
      "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-100 dark:border-amber-700",
    toneClass: "from-amber-50 to-(--tc-surface) dark:from-amber-950/60 dark:to-(--tc-surface)",
  },
  {
    key: "fail",
    label: "Falhou",
    shortLabel: "Falhou",
    ringClass: "border-rose-300 dark:border-rose-700",
    chipClass:
      "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-900/50 dark:text-rose-200 dark:border-rose-700",
    toneClass: "from-rose-50 to-(--tc-surface) dark:from-rose-950/60 dark:to-(--tc-surface)",
  },
  {
    key: "pass",
    label: "Finalizado",
    shortLabel: "Final",
    ringClass: "border-emerald-300 dark:border-emerald-700",
    chipClass:
      "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700",
    toneClass: "from-emerald-50 to-(--tc-surface) dark:from-emerald-950/60 dark:to-(--tc-surface)",
  },
];

export const RUN_CASE_STATUS_VALUES: Record<
  RunCaseStatus,
  "APROVADO" | "FALHA" | "BLOQUEADO" | "NAO_EXECUTADO" | "EM_ANDAMENTO"
> = {
  pass: "APROVADO",
  fail: "FALHA",
  blocked: "BLOQUEADO",
  inProgress: "EM_ANDAMENTO",
  notRun: "NAO_EXECUTADO",
};

const EMPTY_CASE_DRAFT: RunCaseDraft = {
  id: "",
  title: "",
  link: "",
  status: "notRun",
  bug: null,
  fromApi: false,
  origin: "manual",
  type: "manual",
  projectCode: null,
  suiteName: null,
  description: "",
  preconditions: "",
  postconditions: "",
  stepsText: "",
  expectedText: "",
  priority: "",
  severity: "",
  tags: [],
  responsibleName: "",
};

let autoIdCounter = 0;
function nextAutoId() {
  autoIdCounter += 1;
  return `MAN-${String(autoIdCounter).padStart(4, "0")}`;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalTextValue(value: unknown) {
  const text = textValue(value);
  return text ? text : null;
}

function numberValue(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function tagsValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function humanizeToken(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatShortDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatElapsed(value: string | null | undefined) {
  if (!value) return "";
  const start = new Date(value).getTime();
  if (Number.isNaN(start)) return "";
  const diffMinutes = Math.max(0, Math.round((Date.now() - start) / 60000));
  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `${diffMinutes}min`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

function formatDurationBetween(startValue: string | null | undefined, endValue: string | null | undefined) {
  if (!startValue || !endValue) return "";
  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "";
  const diffMinutes = Math.max(0, Math.round((end - start) / 60000));
  if (diffMinutes < 1) return "<1min";
  if (diffMinutes < 60) return `${diffMinutes}min`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

function getStatusLabel(status: RunCaseStatus) {
  return CASE_COLUMNS.find((item) => item.key === status)?.label ?? status;
}

function getEvidenceCount(item: RunCaseDraft) {
  return Math.max(numberValue(item.evidencesCount), item.link ? 1 : 0);
}

function getDefectCount(item: RunCaseDraft) {
  return Math.max(numberValue(item.defectsCount), item.bug ? 1 : 0);
}

function applyStatusTransition(item: RunCaseDraft, toStatus: RunCaseStatus): RunCaseDraft {
  if (item.status === toStatus) return item;
  const now = new Date().toISOString();
  const next: RunCaseDraft = {
    ...item,
    status: toStatus,
    statusUpdatedAt: now,
  };

  if (item.status === "notRun" && toStatus === "inProgress" && !item.startedAt) {
    next.startedAt = now;
  }

  if ((toStatus === "pass" || toStatus === "fail") && !item.finishedAt) {
    next.finishedAt = now;
  }

  if (item.status === "fail" && toStatus === "inProgress") {
    next.finishedAt = null;
    next.retestCount = numberValue(item.retestCount) + 1;
    if (!item.startedAt) next.startedAt = now;
  }

  if (toStatus === "inProgress" && !next.startedAt) {
    next.startedAt = now;
  }

  return next;
}

export function normalizeStoredRunCaseStatus(value: unknown): RunCaseStatus | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (["APROVADO", "PASS", "PASSED", "FINALIZADO", "FINALIZADA", "FINISHED"].includes(normalized)) return "pass";
  if (["FALHA", "FAIL", "FAILED", "FALHOU"].includes(normalized)) return "fail";
  if (["BLOQUEADO", "BLOCKED"].includes(normalized)) return "blocked";
  if (["EM_ANDAMENTO", "IN_PROGRESS", "RUNNING", "ACTIVE", "ANDAMENTO"].includes(normalized)) return "inProgress";
  if (["NAO_EXECUTADO", "NÃƒO_EXECUTADO", "NOT_RUN", "NOT RUN", "UNTESTED", "NEW", "NOVO"].includes(normalized)) return "notRun";
  return null;
}

export function mapStoredCasesToRunCaseDrafts(items: unknown[]): RunCaseDraft[] {
  return items.reduce<RunCaseDraft[]>((accumulator, item) => {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const idValue = record.caseId ?? record.case_id ?? record.id;
    const id = String(idValue ?? "").trim();
    if (!id) return accumulator;

    accumulator.push({
      id,
      title: textValue(record.title) || `Caso ${id}`,
      link: textValue(record.link),
      status: normalizeStoredRunCaseStatus(record.status) ?? "notRun",
      bug: optionalTextValue(record.bug),
      fromApi: Boolean(record.fromApi ?? record.from_api),
      origin: optionalTextValue(record.origin ?? record.source),
      type: optionalTextValue(record.type),
      projectCode: optionalTextValue(record.projectCode ?? record.project_code ?? record.externalProjectCode),
      suiteId: optionalTextValue(record.suiteId ?? record.suite_id),
      suiteName: optionalTextValue(record.suiteName ?? record.suite_name),
      description: optionalTextValue(record.description),
      preconditions: optionalTextValue(record.preconditions ?? record.precondition),
      postconditions: optionalTextValue(record.postconditions ?? record.postcondition),
      stepsText: optionalTextValue(record.stepsText ?? record.steps_text ?? record.steps),
      expectedText: optionalTextValue(record.expectedText ?? record.expected_text ?? record.expected),
      priority: optionalTextValue(record.priority),
      severity: optionalTextValue(record.severity),
      tags: tagsValue(record.tags),
      responsibleName: optionalTextValue(record.responsibleName ?? record.assigneeName ?? record.ownerName),
      defectsCount: numberValue(record.defectsCount ?? record.defects_count),
      evidencesCount: numberValue(record.evidencesCount ?? record.evidences_count),
      startedAt: optionalTextValue(record.startedAt ?? record.started_at),
      finishedAt: optionalTextValue(record.finishedAt ?? record.finished_at),
      statusUpdatedAt: optionalTextValue(record.statusUpdatedAt ?? record.status_updated_at ?? record.updatedAt),
      retestCount: numberValue(record.retestCount ?? record.retest_count),
    });
    return accumulator;
  }, []);
}

export function computeRunCaseStats(cases: RunCaseDraft[]) {
  return {
    pass: cases.filter((item) => item.status === "pass").length,
    fail: cases.filter((item) => item.status === "fail").length,
    blocked: cases.filter((item) => item.status === "blocked").length,
    inProgress: cases.filter((item) => item.status === "inProgress").length,
    notRun: cases.filter((item) => item.status === "notRun").length,
  };
}

function buildPersistedCase(item: RunCaseDraft, status?: RunCaseStatus): RunCaseDraft {
  return {
    ...item,
    status: status ?? item.status,
    id: item.id.trim(),
    title: item.title.trim(),
    link: item.link.trim(),
    bug: item.bug?.trim() || null,
    origin: optionalTextValue(item.origin),
    type: optionalTextValue(item.type),
    projectCode: optionalTextValue(item.projectCode),
    suiteId: optionalTextValue(item.suiteId),
    suiteName: optionalTextValue(item.suiteName),
    description: optionalTextValue(item.description),
    preconditions: optionalTextValue(item.preconditions),
    postconditions: optionalTextValue(item.postconditions),
    stepsText: optionalTextValue(item.stepsText),
    expectedText: optionalTextValue(item.expectedText),
    priority: optionalTextValue(item.priority),
    severity: optionalTextValue(item.severity),
    tags: tagsValue(item.tags),
    responsibleName: optionalTextValue(item.responsibleName),
    defectsCount: numberValue(item.defectsCount),
    evidencesCount: numberValue(item.evidencesCount),
    startedAt: optionalTextValue(item.startedAt),
    finishedAt: optionalTextValue(item.finishedAt),
    statusUpdatedAt: optionalTextValue(item.statusUpdatedAt),
    retestCount: numberValue(item.retestCount),
  };
}

export function RunCasesBoard({
  cases,
  onCasesChange,
  editable = true,
  mode = "manual",
  eyebrow = "Quadro da run",
  title = "Kanban dos casos da run",
  subtitle = "Acompanhe caso por caso com status, responsavel, tempo, defeitos, evidencias e snapshot do que foi testado.",
  emptyMessage = "Nenhum caso nesta coluna.",
  showComposer = true,
}: RunCasesBoardProps) {
  const [columnOrder, setColumnOrder] = useState<RunCaseStatus[]>(["notRun", "inProgress", "blocked", "fail", "pass"]);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [draggingColumnKey, setDraggingColumnKey] = useState<RunCaseStatus | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<RunCaseStatus | null>(null);
  const [caseDraft, setCaseDraft] = useState<RunCaseDraft>({ ...EMPTY_CASE_DRAFT, id: nextAutoId() });
  const [editingCase, setEditingCase] = useState<RunCaseDraft | null>(null);

  const groupedCases = useMemo(
    () =>
      CASE_COLUMNS.reduce<Record<RunCaseStatus, RunCaseDraft[]>>(
        (accumulator, column) => {
          accumulator[column.key] = cases.filter((item) => item.status === column.key);
          return accumulator;
        },
        { notRun: [], inProgress: [], blocked: [], fail: [], pass: [] },
      ),
    [cases],
  );

  const caseStats = useMemo(() => computeRunCaseStats(cases), [cases]);

  function updateCases(updater: RunCaseDraft[] | ((current: RunCaseDraft[]) => RunCaseDraft[])) {
    onCasesChange(typeof updater === "function" ? updater(cases) : updater);
  }

  function handleDraftChange<K extends keyof RunCaseDraft>(field: K, value: RunCaseDraft[K]) {
    setCaseDraft((current) => ({ ...current, [field]: value }));
  }

  function handleAddCase() {
    const trimmedId = caseDraft.id.trim() || nextAutoId();
    const trimmedTitle = caseDraft.title.trim();
    if (!trimmedId || !trimmedTitle) return;

    const newCase = buildPersistedCase(
      {
        ...caseDraft,
        id: trimmedId,
        title: trimmedTitle,
        fromApi: false,
      },
      caseDraft.status,
    );

    updateCases((current) => [...current.filter((item) => item.id !== trimmedId), newCase]);
    setCaseDraft({ ...EMPTY_CASE_DRAFT, id: nextAutoId(), status: caseDraft.status });
  }

  function handleRemoveCase(id: string) {
    updateCases((current) => current.filter((item) => item.id !== id));
  }

  function handleSaveEditingCase() {
    if (!editingCase) return;
    const trimmedId = editingCase.id.trim();
    const trimmedTitle = editingCase.title.trim();
    if (!trimmedId || !trimmedTitle) return;

    updateCases((current) =>
      current.map((item) =>
        item.id === trimmedId
          ? buildPersistedCase(applyStatusTransition({ ...item, ...editingCase }, editingCase.status), editingCase.status)
          : item,
      ),
    );
    setEditingCase(null);
  }

  function handleCardDragStart(event: DragEvent, id: string) {
    if (!editable) return;
    setDraggingCardId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("cardId", id);
  }

  function handleCardDrop(event: DragEvent, toColumn: RunCaseStatus) {
    if (!editable) return;
    event.preventDefault();
    const id = event.dataTransfer.getData("cardId");
    if (!id) return;
    updateCases((current) => current.map((item) => (item.id === id ? applyStatusTransition(item, toColumn) : item)));
    setDraggingCardId(null);
    setDragOverColumn(null);
  }

  function handleColumnDragStart(event: DragEvent, key: RunCaseStatus) {
    if (!editable) return;
    setDraggingColumnKey(key);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("columnKey", key);
  }

  function handleColumnDrop(event: DragEvent, targetKey: RunCaseStatus) {
    if (!editable) return;
    event.preventDefault();
    const sourceKey = event.dataTransfer.getData("columnKey");
    if (!sourceKey || sourceKey === targetKey) {
      setDraggingColumnKey(null);
      setDragOverColumn(null);
      return;
    }

    setColumnOrder((current) => {
      const next = [...current];
      const fromIndex = next.indexOf(sourceKey as RunCaseStatus);
      const toIndex = next.indexOf(targetKey);
      if (fromIndex === -1 || toIndex === -1) return current;
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, sourceKey as RunCaseStatus);
      return next;
    });
    setDraggingColumnKey(null);
    setDragOverColumn(null);
  }

  return (
    <>
      {editable && showComposer ? (
        <div className="rounded-[28px] border border-[var(--tc-border,#dfe5f1)] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
              <FiPlus className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--tc-accent,#ef0001)]">Casos executados</p>
              <h3 className="mt-1 text-lg font-extrabold text-[var(--tc-text,#0b1a3c)]">Adicionar ao quadro</h3>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">ID do caso</span>
              <input
                type="text"
                value={caseDraft.id}
                onChange={(event) => handleDraftChange("id", event.target.value)}
                className="w-full rounded-[20px] border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none transition focus:border-[var(--tc-accent,#ef0001)] focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                placeholder="Ex.: QC-142"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Status</span>
              <select
                aria-label="Status do caso"
                value={caseDraft.status}
                onChange={(event) => handleDraftChange("status", event.target.value as RunCaseStatus)}
                className="w-full rounded-[20px] border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none transition focus:border-[var(--tc-accent,#ef0001)] focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
              >
                {CASE_COLUMNS.map((column) => (
                  <option key={column.key} value={column.key}>
                    {column.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Projeto</span>
              <input
                type="text"
                value={caseDraft.projectCode ?? ""}
                onChange={(event) => handleDraftChange("projectCode", event.target.value)}
                className="w-full rounded-[20px] border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none transition focus:border-[var(--tc-accent,#ef0001)] focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                placeholder="Ex.: CID"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Responsavel</span>
              <input
                type="text"
                value={caseDraft.responsibleName ?? ""}
                onChange={(event) => handleDraftChange("responsibleName", event.target.value)}
                className="w-full rounded-[20px] border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none transition focus:border-[var(--tc-accent,#ef0001)] focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                placeholder="Herdado da run se vazio"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Titulo *</span>
              <input
                type="text"
                value={caseDraft.title}
                onChange={(event) => handleDraftChange("title", event.target.value)}
                className="w-full rounded-[20px] border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none transition focus:border-[var(--tc-accent,#ef0001)] focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                placeholder="Nome do caso executado"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Suite/Pasta</span>
              <input
                type="text"
                value={caseDraft.suiteName ?? ""}
                onChange={(event) => handleDraftChange("suiteName", event.target.value)}
                className="w-full rounded-[20px] border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none transition focus:border-[var(--tc-accent,#ef0001)] focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                placeholder="Ex.: Login"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Origem</span>
              <input
                type="text"
                value={caseDraft.origin ?? ""}
                onChange={(event) => handleDraftChange("origin", event.target.value)}
                className="w-full rounded-[20px] border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none transition focus:border-[var(--tc-accent,#ef0001)] focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                placeholder="manual, qase, playwright"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Link de evidencia</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <FiLink2 className="h-4 w-4" />
                </span>
                <input
                  type="url"
                  value={caseDraft.link}
                  onChange={(event) => handleDraftChange("link", event.target.value)}
                  className="w-full rounded-[20px] border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] py-3 pr-4 pl-11 text-sm text-[var(--tc-text,#0f172a)] outline-none transition focus:border-[var(--tc-accent,#ef0001)] focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                  placeholder="https://..."
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Defeito vinculado</span>
              <input
                type="text"
                value={caseDraft.bug ?? ""}
                onChange={(event) => handleDraftChange("bug", event.target.value)}
                className="w-full rounded-[20px] border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-3 text-sm text-[var(--tc-text,#0f172a)] outline-none transition focus:border-[var(--tc-accent,#ef0001)] focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                placeholder="Ex.: BUG-123 ou link"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm text-[var(--tc-text-secondary,#4b5563)]">
              O caso entra na run como snapshot, com origem, projeto, suite, evidencias e defeitos preservados.
            </div>
            <button
              type="button"
              onClick={handleAddCase}
              className="rounded-full bg-[var(--tc-accent,#ef0001)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white shadow transition hover:brightness-110 disabled:opacity-60"
              disabled={!caseDraft.title.trim()}
            >
              Adicionar caso
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[28px] border border-[var(--tc-border,#dfe5f1)] bg-white shadow-sm">
        <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--tc-accent,#ef0001)]">{eyebrow}</p>
            <h3 className="mt-1 text-lg font-extrabold text-[var(--tc-text,#0b1a3c)]">{title}</h3>
            <p className="mt-2 max-w-3xl text-sm text-[var(--tc-text-secondary,#4b5563)]">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
              <FiCheckCircle className="h-3.5 w-3.5" />
              {cases.length} caso(s)
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
              {caseStats.inProgress} em andamento
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              {caseStats.pass} finalizados
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">
              {caseStats.fail} falharam
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              {caseStats.blocked} bloqueados
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] border-t border-[var(--tc-border,#dfe5f1)]">
          {columnOrder.map((columnKey) => {
            const column = CASE_COLUMNS.find((item) => item.key === columnKey)!;
            const columnCases = groupedCases[column.key];
            const isColumnDragOver = dragOverColumn === column.key && draggingColumnKey !== null && draggingColumnKey !== column.key;
            const isCardDragOver = dragOverColumn === column.key && draggingCardId !== null;

            return (
              <div
                key={column.key}
                draggable={editable}
                onDragStart={(event) => handleColumnDragStart(event, column.key)}
                onDragOver={(event) => {
                  if (!editable) return;
                  event.preventDefault();
                  setDragOverColumn(column.key);
                }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(event) => {
                  if (!editable) return;
                  if (draggingColumnKey) handleColumnDrop(event, column.key);
                  else handleCardDrop(event, column.key);
                }}
                onDragEnd={() => {
                  setDraggingColumnKey(null);
                  setDragOverColumn(null);
                }}
                className={[
                  "bg-linear-to-b p-4 transition-all",
                  column.toneClass,
                  draggingColumnKey === column.key ? "opacity-40 scale-[0.97]" : "",
                  isColumnDragOver ? "ring-inset ring-2 ring-(--tc-accent,#ef0001) brightness-95" : "",
                  isCardDragOver ? "ring-inset ring-2 ring-slate-400 brightness-95" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div
                    className={`rounded-full border px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.2em] ${editable ? "cursor-grab select-none" : ""} ${column.chipClass}`}
                    title={editable ? "Segure para mover a coluna" : undefined}
                  >
                    {column.label}
                  </div>
                  <span className="text-base font-extrabold text-[var(--tc-text,#0b1a3c)]">{columnCases.length}</span>
                </div>

                <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
                  {columnCases.length === 0 ? (
                    <div
                      className={[
                        "rounded-[20px] border border-dashed px-4 py-7 text-base text-[var(--tc-text-muted,#4b5563)] transition-colors",
                        isCardDragOver
                          ? "border-[var(--tc-accent,#ef0001)] bg-[var(--tc-accent,#ef0001)]/5"
                          : "border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface-alt,#f8fafc)]",
                      ].join(" ")}
                    >
                      {isCardDragOver ? "Solte aqui" : emptyMessage}
                    </div>
                  ) : (
                    columnCases.map((item) => {
                      const defectCount = getDefectCount(item);
                      const evidenceCount = getEvidenceCount(item);
                      const statusElapsed = formatElapsed(item.statusUpdatedAt ?? item.startedAt);
                      const totalElapsed = item.finishedAt
                        ? formatDurationBetween(item.startedAt, item.finishedAt)
                        : item.startedAt
                          ? formatElapsed(item.startedAt)
                          : "";

                      return (
                        <article
                          key={`${column.key}-${item.id}`}
                          draggable={editable}
                          onDragStart={(event) => {
                            event.stopPropagation();
                            handleCardDragStart(event, item.id);
                          }}
                          onDragEnd={() => setDraggingCardId(null)}
                          onClick={() => editable && setEditingCase({ ...item })}
                          className={[
                            "relative rounded-[22px] border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#fff)] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition-all hover:border-[var(--tc-accent,#ef0001)]/30 hover:shadow-md",
                            editable ? "cursor-pointer" : "",
                            draggingCardId === item.id ? "opacity-40" : "",
                          ].join(" ")}
                        >
                          <div className="pr-20">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--tc-text-muted,#4b5563)]">
                                {item.id}
                              </p>
                              {item.fromApi || item.origin ? (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                  {humanizeToken(item.origin) || "API"}
                                </span>
                              ) : null}
                              {item.type ? (
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                  {humanizeToken(item.type)}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-base font-semibold leading-6 text-[var(--tc-text,#0b1a3c)]">{item.title}</p>

                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-[var(--tc-text-muted,#4b5563)]">
                              {item.responsibleName ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
                                  <FiUser className="h-3 w-3" />
                                  {item.responsibleName}
                                </span>
                              ) : null}
                              {item.projectCode || item.suiteName ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
                                  <FiFlag className="h-3 w-3" />
                                  {[item.projectCode, item.suiteName].filter(Boolean).join(" / ")}
                                </span>
                              ) : null}
                              {statusElapsed ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
                                  <FiClock className="h-3 w-3" />
                                  {statusElapsed} no status
                                </span>
                              ) : null}
                              {totalElapsed ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1">
                                  Total {totalElapsed}
                                </span>
                              ) : null}
                              {defectCount ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-rose-700">
                                  <FiAlertCircle className="h-3 w-3" />
                                  Defeitos: {defectCount}
                                </span>
                              ) : null}
                              {evidenceCount ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                                  <FiPaperclip className="h-3 w-3" />
                                  Evidencias: {evidenceCount}
                                </span>
                              ) : null}
                            </div>

                            {item.priority || item.severity || item.tags?.length ? (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {item.priority ? (
                                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    P: {humanizeToken(item.priority)}
                                  </span>
                                ) : null}
                                {item.severity ? (
                                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    S: {humanizeToken(item.severity)}
                                  </span>
                                ) : null}
                                {item.tags?.slice(0, 3).map((tag) => (
                                  <span
                                    key={`${item.id}-${tag}`}
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                                  >
                                    <FiTag className="h-3 w-3" />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            {item.link ? (
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[var(--tc-accent,#ef0001)]"
                              >
                                <FiLink2 className="h-3.5 w-3.5" />
                                {mode === "integration" ? "Abrir evidencia/origem" : "Abrir link"}
                              </a>
                            ) : null}
                          </div>

                          {editable ? (
                            <div className="absolute top-3 right-3 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setEditingCase({ ...item });
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface-alt,#f8fafc)] text-[var(--tc-text-muted,#4b5563)] transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                                aria-label={`Editar caso ${item.id}`}
                                title="Editar caso"
                              >
                                <FiEdit2 className="h-3 w-3" />
                              </button>
                              {!item.fromApi ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleRemoveCase(item.id);
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface-alt,#f8fafc)] text-[var(--tc-text-muted,#4b5563)] transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                                  aria-label={`Remover caso ${item.id}`}
                                  title="Remover caso"
                                >
                                  <FiX className="h-3 w-3" />
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editingCase ? (
        <div
          className="fixed inset-0 z-110 flex items-center justify-center overflow-auto bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setEditingCase(null);
          }}
        >
          <div className="w-full max-w-3xl rounded-[28px] border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#fff)] shadow-[0_40px_140px_rgba(15,23,42,0.38)]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--tc-border,#dfe5f1)] px-6 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--tc-accent,#ef0001)]">Caso {editingCase.id}</p>
                <h3 className="mt-1 text-lg font-extrabold text-[var(--tc-text,#0b1a3c)]">Snapshot do caso nesta run</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCase(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--tc-border,#dfe5f1)] text-[var(--tc-text-muted,#4b5563)] transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Fechar detalhes"
                title="Fechar"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(100dvh-12rem)] space-y-4 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">ID</span>
                  <input
                    type="text"
                    value={editingCase.id}
                    readOnly
                    className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-slate-50 px-4 py-2.5 text-sm text-[var(--tc-text-muted,#6b7280)]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Status</span>
                  <select
                    aria-label="Status do caso"
                    value={editingCase.status}
                    onChange={(event) =>
                      setEditingCase((current) =>
                        current ? applyStatusTransition(current, event.target.value as RunCaseStatus) : current,
                      )
                    }
                    className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-2.5 text-sm text-[var(--tc-text,#0f172a)] outline-none transition focus:border-[var(--tc-accent,#ef0001)] focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                  >
                    {CASE_COLUMNS.map((column) => (
                      <option key={column.key} value={column.key}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Titulo *</span>
                <input
                  type="text"
                  value={editingCase.title}
                  onChange={(event) => setEditingCase((current) => (current ? { ...current, title: event.target.value } : current))}
                  className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-2.5 text-sm text-[var(--tc-text,#0f172a)] outline-none transition focus:border-[var(--tc-accent,#ef0001)] focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Projeto</span>
                  <input
                    type="text"
                    value={editingCase.projectCode ?? ""}
                    onChange={(event) => setEditingCase((current) => (current ? { ...current, projectCode: event.target.value } : current))}
                    className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-2.5 text-sm text-[var(--tc-text,#0f172a)]"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Suite</span>
                  <input
                    type="text"
                    value={editingCase.suiteName ?? ""}
                    onChange={(event) => setEditingCase((current) => (current ? { ...current, suiteName: event.target.value } : current))}
                    className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-2.5 text-sm text-[var(--tc-text,#0f172a)]"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Responsavel</span>
                  <input
                    type="text"
                    value={editingCase.responsibleName ?? ""}
                    onChange={(event) =>
                      setEditingCase((current) => (current ? { ...current, responsibleName: event.target.value } : current))
                    }
                    className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-2.5 text-sm text-[var(--tc-text,#0f172a)]"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Prioridade</span>
                  <input
                    type="text"
                    value={editingCase.priority ?? ""}
                    onChange={(event) => setEditingCase((current) => (current ? { ...current, priority: event.target.value } : current))}
                    className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-2.5 text-sm text-[var(--tc-text,#0f172a)]"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Severidade</span>
                  <input
                    type="text"
                    value={editingCase.severity ?? ""}
                    onChange={(event) => setEditingCase((current) => (current ? { ...current, severity: event.target.value } : current))}
                    className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-2.5 text-sm text-[var(--tc-text,#0f172a)]"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Tags</span>
                  <input
                    type="text"
                    value={(editingCase.tags ?? []).join(", ")}
                    onChange={(event) =>
                      setEditingCase((current) => (current ? { ...current, tags: tagsValue(event.target.value) } : current))
                    }
                    className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-2.5 text-sm text-[var(--tc-text,#0f172a)]"
                    placeholder="regressao, smoke"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Descricao</span>
                  <textarea
                    rows={3}
                    value={editingCase.description ?? ""}
                    onChange={(event) => setEditingCase((current) => (current ? { ...current, description: event.target.value } : current))}
                    className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-2.5 text-sm text-[var(--tc-text,#0f172a)]"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Resultado esperado</span>
                  <textarea
                    rows={3}
                    value={editingCase.expectedText ?? ""}
                    onChange={(event) => setEditingCase((current) => (current ? { ...current, expectedText: event.target.value } : current))}
                    className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-2.5 text-sm text-[var(--tc-text,#0f172a)]"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Pre-condicoes</span>
                  <textarea
                    rows={2}
                    value={editingCase.preconditions ?? ""}
                    onChange={(event) => setEditingCase((current) => (current ? { ...current, preconditions: event.target.value } : current))}
                    className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-2.5 text-sm text-[var(--tc-text,#0f172a)]"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Pos-condicoes</span>
                  <textarea
                    rows={2}
                    value={editingCase.postconditions ?? ""}
                    onChange={(event) => setEditingCase((current) => (current ? { ...current, postconditions: event.target.value } : current))}
                    className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-2.5 text-sm text-[var(--tc-text,#0f172a)]"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Passos executaveis</span>
                <textarea
                  rows={6}
                  value={editingCase.stepsText ?? ""}
                  onChange={(event) => setEditingCase((current) => (current ? { ...current, stepsText: event.target.value } : current))}
                  className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-2.5 text-sm text-[var(--tc-text,#0f172a)]"
                  placeholder={"1. Acessar tela\n2. Informar dados\n3. Validar mensagem"}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">
                    {mode === "integration" ? "Evidencia / link externo" : "Link de evidencia"}
                  </span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <FiLink2 className="h-4 w-4" />
                    </span>
                    <input
                      type="url"
                      value={editingCase.link}
                      onChange={(event) => setEditingCase((current) => (current ? { ...current, link: event.target.value } : current))}
                      className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] py-2.5 pr-4 pl-11 text-sm text-[var(--tc-text,#0f172a)] outline-none transition focus:border-[var(--tc-accent,#ef0001)] focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                      placeholder="https://..."
                    />
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--tc-text-muted,#6b7280)]">Defeito vinculado</span>
                  <input
                    type="text"
                    value={editingCase.bug ?? ""}
                    onChange={(event) => setEditingCase((current) => (current ? { ...current, bug: event.target.value } : current))}
                    className="w-full rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-[var(--tc-surface,#f8fafc)] px-4 py-2.5 text-sm text-[var(--tc-text,#0f172a)] outline-none transition focus:border-[var(--tc-accent,#ef0001)] focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                    placeholder="Ex.: BUG-123 ou link"
                  />
                </label>
              </div>

              <div className="grid gap-3 rounded-2xl border border-[var(--tc-border,#dfe5f1)] bg-slate-50 p-4 text-xs text-[var(--tc-text-muted,#4b5563)] sm:grid-cols-3">
                <p>
                  <strong>Status:</strong> {getStatusLabel(editingCase.status)}
                </p>
                <p>
                  <strong>Inicio:</strong> {formatShortDateTime(editingCase.startedAt) || "Nao iniciado"}
                </p>
                <p>
                  <strong>Fim:</strong> {formatShortDateTime(editingCase.finishedAt) || "Aberto"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[var(--tc-border,#dfe5f1)] px-6 py-4">
              <button
                type="button"
                onClick={() => setEditingCase(null)}
                className="rounded-2xl border border-[var(--tc-border,#dfe5f1)] px-5 py-2.5 text-sm font-semibold text-[var(--tc-text,#0b1a3c)] transition hover:border-slate-400"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditingCase}
                disabled={!editingCase.title.trim()}
                className="rounded-2xl bg-[var(--tc-accent,#ef0001)] px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:brightness-110 disabled:opacity-60"
              >
                Salvar alteracoes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

