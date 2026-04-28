"use client";

import { type DragEvent, useMemo, useState } from "react";
import { FiCheckCircle, FiEdit2, FiLink2, FiPlus, FiX } from "react-icons/fi";

export type RunCaseStatus = "pass" | "fail" | "blocked" | "notRun";
export type RunCaseMode = "manual" | "integration";

export type RunCaseDraft = {
  id: string;
  title: string;
  link: string;
  status: RunCaseStatus;
  bug: string | null;
  fromApi?: boolean;
};

type CaseColumn = {
  key: RunCaseStatus;
  label: string;
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
    key: "pass",
    label: "Aprovado",
    ringClass: "border-emerald-300 dark:border-emerald-700",
    chipClass: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700",
    toneClass: "from-emerald-50 to-(--tc-surface) dark:from-emerald-950/60 dark:to-(--tc-surface)",
  },
  {
    key: "fail",
    label: "Falha",
    ringClass: "border-rose-300 dark:border-rose-700",
    chipClass: "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-900/50 dark:text-rose-200 dark:border-rose-700",
    toneClass: "from-rose-50 to-(--tc-surface) dark:from-rose-950/60 dark:to-(--tc-surface)",
  },
  {
    key: "blocked",
    label: "Bloqueado",
    ringClass: "border-amber-300 dark:border-amber-700",
    chipClass: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-100 dark:border-amber-700",
    toneClass: "from-amber-50 to-(--tc-surface) dark:from-amber-950/60 dark:to-(--tc-surface)",
  },
  {
    key: "notRun",
    label: "Não executado",
    ringClass: "border-slate-300 dark:border-slate-600",
    chipClass: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-600",
    toneClass: "from-slate-50 to-(--tc-surface) dark:from-slate-900/60 dark:to-(--tc-surface)",
  },
];

export const RUN_CASE_STATUS_VALUES: Record<RunCaseStatus, "APROVADO" | "FALHA" | "BLOQUEADO" | "NAO_EXECUTADO"> = {
  pass: "APROVADO",
  fail: "FALHA",
  blocked: "BLOQUEADO",
  notRun: "NAO_EXECUTADO",
};

const EMPTY_CASE_DRAFT: RunCaseDraft = {
  id: "",
  title: "",
  link: "",
  status: "notRun",
  bug: null,
  fromApi: false,
};

let autoIdCounter = 0;
function nextAutoId() {
  autoIdCounter += 1;
  return `MAN-${String(autoIdCounter).padStart(4, "0")}`;
}

export function normalizeStoredRunCaseStatus(value: unknown): RunCaseStatus | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (["APROVADO", "PASS", "PASSED"].includes(normalized)) return "pass";
  if (["FALHA", "FAIL", "FAILED"].includes(normalized)) return "fail";
  if (["BLOQUEADO", "BLOCKED"].includes(normalized)) return "blocked";
  if (["NAO_EXECUTADO", "NOT_RUN", "NOT RUN", "UNTESTED"].includes(normalized)) return "notRun";
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
      title: typeof record.title === "string" && record.title.trim() ? record.title.trim() : `Caso ${id}`,
      link: typeof record.link === "string" ? record.link.trim() : "",
      status: normalizeStoredRunCaseStatus(record.status) ?? "notRun",
      bug: typeof record.bug === "string" && record.bug.trim() ? record.bug.trim() : null,
      fromApi: Boolean(record.fromApi ?? record.from_api),
    });
    return accumulator;
  }, []);
}

export function computeRunCaseStats(cases: RunCaseDraft[]) {
  return {
    pass: cases.filter((item) => item.status === "pass").length,
    fail: cases.filter((item) => item.status === "fail").length,
    blocked: cases.filter((item) => item.status === "blocked").length,
    notRun: cases.filter((item) => item.status === "notRun").length,
  };
}

export function RunCasesBoard({
  cases,
  onCasesChange,
  editable = true,
  mode = "manual",
  eyebrow = "Quadro da run",
  title = "Kanban dos casos executados",
  subtitle = "Organize os casos por status e edite o que realmente será persistido nesta run.",
  emptyMessage = "Nenhum caso nesta coluna.",
  showComposer = true,
}: RunCasesBoardProps) {
  const [columnOrder, setColumnOrder] = useState<RunCaseStatus[]>(["pass", "fail", "blocked", "notRun"]);
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
        { pass: [], fail: [], blocked: [], notRun: [] },
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

    updateCases((current) => {
      const next = current.filter((item) => item.id !== trimmedId);
      next.push({
        id: trimmedId,
        title: trimmedTitle,
        link: caseDraft.link.trim(),
        status: caseDraft.status,
        bug: caseDraft.bug?.trim() || null,
        fromApi: false,
      });
      return next;
    });

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
          ? {
              ...item,
              ...editingCase,
              id: trimmedId,
              title: trimmedTitle,
              link: editingCase.link.trim(),
              bug: editingCase.bug?.trim() || null,
            }
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
    updateCases((current) => current.map((item) => (item.id === id ? { ...item, status: toColumn } : item)));
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
        <div className="rounded-[28px] border border-(--tc-border,#dfe5f1) bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
              <FiPlus className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Casos executados</p>
              <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Adicionar ao quadro</h3>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">ID do caso</span>
              <input
                type="text"
                value={caseDraft.id}
                onChange={(event) => handleDraftChange("id", event.target.value)}
                className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                placeholder="Deixe vazio para gerar automaticamente"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Status</span>
              <select
                aria-label="Status do caso"
                value={caseDraft.status}
                onChange={(event) => handleDraftChange("status", event.target.value as RunCaseStatus)}
                className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
              >
                {CASE_COLUMNS.map((column) => (
                  <option key={column.key} value={column.key}>
                    {column.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Título *</span>
              <input
                type="text"
                value={caseDraft.title}
                onChange={(event) => handleDraftChange("title", event.target.value)}
                className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                placeholder="Nome do caso executado"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Link de evidência</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <FiLink2 className="h-4 w-4" />
                </span>
                <input
                  type="url"
                  value={caseDraft.link}
                  onChange={(event) => handleDraftChange("link", event.target.value)}
                  className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) py-3 pr-4 pl-11 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                  placeholder="https://..."
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Bug vinculado</span>
              <input
                type="text"
                value={caseDraft.bug ?? ""}
                onChange={(event) => handleDraftChange("bug", event.target.value)}
                className="w-full rounded-[20px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                placeholder="Ex.: BUG-123 ou link"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm text-(--tc-text-secondary,#4b5563)">
              Título obrigatório. O quadro salva só os campos que realmente persistem na run.
            </div>
            <button
              type="button"
              onClick={handleAddCase}
              className="rounded-full bg-(--tc-accent,#ef0001) px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white shadow transition hover:brightness-110 disabled:opacity-60"
              disabled={!caseDraft.title.trim()}
            >
              Adicionar caso
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[28px] border border-(--tc-border,#dfe5f1) bg-white shadow-sm">
        <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">{eyebrow}</p>
            <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">{title}</h3>
            <p className="mt-2 max-w-3xl text-sm text-(--tc-text-secondary,#4b5563)">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
              <FiCheckCircle className="h-3.5 w-3.5" />
              {cases.length} caso(s)
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              {caseStats.pass} pass
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">
              {caseStats.fail} fail
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              {caseStats.blocked} blocked
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] border-t border-(--tc-border,#dfe5f1)">
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
                ].filter(Boolean).join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div
                    className={`rounded-full border px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.2em] ${editable ? "cursor-grab select-none" : ""} ${column.chipClass}`}
                    title={editable ? "Segure para mover a coluna" : undefined}
                  >
                    {column.label}
                  </div>
                  <span className="text-base font-extrabold text-(--tc-text,#0b1a3c)">{columnCases.length}</span>
                </div>

                <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
                  {columnCases.length === 0 ? (
                    <div
                      className={[
                        "rounded-[20px] border border-dashed px-4 py-7 text-base text-(--tc-text-muted,#4b5563) transition-colors",
                        isCardDragOver
                          ? "border-(--tc-accent,#ef0001) bg-(--tc-accent,#ef0001)/5"
                          : "border-(--tc-border,#dfe5f1) bg-(--tc-surface-alt,#f8fafc)",
                      ].join(" ")}
                    >
                      {isCardDragOver ? "Solte aqui ↓" : emptyMessage}
                    </div>
                  ) : (
                    columnCases.map((item) => (
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
                          "relative rounded-[22px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#fff) p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition-all hover:border-(--tc-accent,#ef0001)/30 hover:shadow-md",
                          editable ? "cursor-pointer" : "",
                          draggingCardId === item.id ? "opacity-40" : "",
                        ].join(" ")}
                      >
                        <div className="pr-20">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-(--tc-text-muted,#4b5563)">
                              Caso {item.id}
                            </p>
                            {item.fromApi ? (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                                API
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-base font-semibold leading-6 text-(--tc-text,#0b1a3c)">{item.title}</p>
                          {item.bug ? (
                            <p className="mt-1 text-xs text-(--tc-text-muted,#4b5563)">Bug: {item.bug}</p>
                          ) : null}
                          {item.link ? (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-(--tc-accent,#ef0001)"
                            >
                              <FiLink2 className="h-3.5 w-3.5" />
                              {mode === "integration" ? "Abrir evidência" : "Abrir link"}
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
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-(--tc-border,#dfe5f1) bg-(--tc-surface-alt,#f8fafc) text-(--tc-text-muted,#4b5563) transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
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
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-(--tc-border,#dfe5f1) bg-(--tc-surface-alt,#f8fafc) text-(--tc-text-muted,#4b5563) transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                                aria-label={`Remover caso ${item.id}`}
                                title="Remover caso"
                              >
                                <FiX className="h-3 w-3" />
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    ))
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
          <div className="w-full max-w-2xl rounded-[28px] border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#fff) shadow-[0_40px_140px_rgba(15,23,42,0.38)]">
            <div className="flex items-center justify-between gap-4 border-b border-(--tc-border,#dfe5f1) px-6 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-(--tc-accent,#ef0001)">Caso {editingCase.id}</p>
                <h3 className="mt-1 text-lg font-extrabold text-(--tc-text,#0b1a3c)">Detalhes persistidos do caso</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCase(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-(--tc-border,#dfe5f1) text-(--tc-text-muted,#4b5563) transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Fechar detalhes"
                title="Fechar"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(100dvh-12rem)] space-y-4 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">ID</span>
                  <input
                    type="text"
                    value={editingCase.id}
                    readOnly
                    className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-slate-50 px-4 py-2.5 text-sm text-(--tc-text-muted,#6b7280)"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Status</span>
                  <select
                    aria-label="Status do caso"
                    value={editingCase.status}
                    onChange={(event) => setEditingCase((current) => (current ? { ...current, status: event.target.value as RunCaseStatus } : current))}
                    className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-2.5 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
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
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Título *</span>
                <input
                  type="text"
                  value={editingCase.title}
                  onChange={(event) => setEditingCase((current) => (current ? { ...current, title: event.target.value } : current))}
                  className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-2.5 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                  {mode === "integration" ? "Evidência / link externo" : "Link de evidência"}
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <FiLink2 className="h-4 w-4" />
                  </span>
                  <input
                    type="url"
                    value={editingCase.link}
                    onChange={(event) => setEditingCase((current) => (current ? { ...current, link: event.target.value } : current))}
                    className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) py-2.5 pr-4 pl-11 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                    placeholder="https://..."
                  />
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">Bug vinculado</span>
                <input
                  type="text"
                  value={editingCase.bug ?? ""}
                  onChange={(event) => setEditingCase((current) => (current ? { ...current, bug: event.target.value } : current))}
                  className="w-full rounded-2xl border border-(--tc-border,#dfe5f1) bg-(--tc-surface,#f8fafc) px-4 py-2.5 text-sm text-(--tc-text,#0f172a) outline-none transition focus:border-(--tc-accent,#ef0001) focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
                  placeholder="Ex.: BUG-123 ou link"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-(--tc-border,#dfe5f1) px-6 py-4">
              <button
                type="button"
                onClick={() => setEditingCase(null)}
                className="rounded-2xl border border-(--tc-border,#dfe5f1) px-5 py-2.5 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-slate-400"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditingCase}
                disabled={!editingCase.title.trim()}
                className="rounded-2xl bg-(--tc-accent,#ef0001) px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:brightness-110 disabled:opacity-60"
              >
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
