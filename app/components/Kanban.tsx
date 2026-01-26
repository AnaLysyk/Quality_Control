"use client";

import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { FiExternalLink } from "react-icons/fi";
import { KanbanData, KanbanItem } from "@/types/kanban";

type DragInfo = { item: KanbanItem; from: keyof KanbanData };

const columns: {
  key: keyof KanbanData;
  label: string;
  bgClass: string;
  borderClass: string;
}[] = [
  { key: "pass", label: "Pass", bgClass: "bg-(--success,rgba(124,211,67,0.12))", borderClass: "border-(--success,#7cd343)" },
  { key: "fail", label: "Fail", bgClass: "bg-(--tc-accent-soft,rgba(239,0,1,0.12))", borderClass: "border-(--tc-accent,#ef0001)" },
  { key: "blocked", label: "Blocked", bgClass: "bg-[rgba(255,167,58,0.12)]", borderClass: "border-(--color-cds,#ffa73a)" },
  { key: "notRun", label: "Not Run", bgClass: "bg-[rgba(15,22,38,0.08)]", borderClass: "border-(--tc-surface-muted,#0f1626)" },
];

type KanbanProps = {
  data: KanbanData;
  project: string;
  runId: number;
  qaseProject?: string;
  companySlug?: string;
  persistEndpoint?: string;
  editable?: boolean;
  allowStatusChange?: boolean;
  allowLinkEdit?: boolean;
  onChange?: (data: KanbanData) => void;
};

export default function Kanban({
  data,
  project,
  runId,
  qaseProject,
  companySlug,
  persistEndpoint,
  editable = false,
  allowStatusChange = false,
  allowLinkEdit = false,
  onChange,
}: KanbanProps) {
  const [localData, setLocalData] = useState<KanbanData>(data);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLinkValue, setEditingLinkValue] = useState("");
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const projectAbbr = (qaseProject || project || "").toUpperCase();

  const hasItems =
    localData.pass.length ||
    localData.fail.length ||
    localData.blocked.length ||
    localData.notRun.length;

  // Sincroniza dados externos (ex.: localStorage ou troca de slug) com o estado interno do Kanban.
  useEffect(() => {
    setLocalData((prev) => (prev === data ? prev : data));
  }, [data]);

  // Expõe mudanças para quem consome o componente (ex.: persistir em localStorage).
  useEffect(() => {
    onChange?.(localData);
  }, [localData, onChange]);

  const getItemKey = (item: KanbanItem, fallback: string) =>
    item.dbId ? `db-${item.dbId}` : item.id ? `case-${item.id}` : fallback;

  function normalizeToColumnKey(value: unknown): keyof KanbanData {
    if (typeof value !== "string") return "notRun";
    const raw = value.trim();
    if (!raw) return "notRun";

    // Accept both stored manual-case statuses (PASS/FAIL/...) and UI column keys (pass/fail/...)
    const lower = raw.toLowerCase();
    if (lower === "pass" || lower === "passed") return "pass";
    if (lower === "fail" || lower === "failed") return "fail";
    if (lower === "blocked") return "blocked";
    if (lower === "notrun" || lower === "not_run" || lower === "not run" || lower === "untested" || lower === "notrun") return "notRun";

    const upper = raw.toUpperCase();
    if (upper === "PASS" || upper === "PASSED") return "pass";
    if (upper === "FAIL" || upper === "FAILED") return "fail";
    if (upper === "BLOCKED") return "blocked";
    if (upper === "NOTRUN" || upper === "NOT_RUN" || upper === "NOT RUN" || upper === "UNTESTED") return "notRun";

    return "notRun";
  }

  function buildCaseLink(caseId?: number | string | null) {
    if (!caseId || !projectAbbr) return null;
    return `https://app.qase.io/case/${projectAbbr}/${caseId}`;
  }

  type KanbanPayload = Record<string, unknown>;

  async function persistKanbanUpdate(payload: KanbanPayload, method: "POST" | "PATCH" = "PATCH") {
    const endpoint = persistEndpoint || "/api/kanban";
    const shouldAugmentDefaultEndpoint = endpoint === "/api/kanban";
    const normalizedPayload = shouldAugmentDefaultEndpoint
      ? {
          project: projectAbbr || project,
          runId,
          ...(companySlug ? { slug: companySlug } : {}),
          ...payload,
        }
      : payload;
    const res = await fetch(endpoint, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedPayload),
    });
    if (!res.ok) throw new Error("Falha ao salvar");
    return res.json();
  }

  async function persistApiLinkUpdate(params: {
    caseId: string | number;
    title?: string | null;
    status: keyof KanbanData;
    link: string;
    bug?: string | null;
  }) {
    const res = await fetch("/api/kanban/link", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: projectAbbr || project,
        runId,
        ...(companySlug ? { slug: companySlug } : {}),
        caseId: params.caseId,
        title: params.title ?? "",
        status: params.status,
        link: params.link,
        ...(params.bug !== undefined ? { bug: params.bug } : {}),
      }),
    });
    if (!res.ok) throw new Error("Falha ao salvar link");
    return res.json();
  }

  // Carrega casos persistidos (manual)
  useEffect(() => {
    if (!persistEndpoint) return;

    (async () => {
      try {
        const res = await fetch(persistEndpoint, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        const rawRows: unknown[] = Array.isArray(json) ? json : (json as { items?: unknown[] } | null)?.items ?? [];
        if (!Array.isArray(rawRows)) return;

        const merged: KanbanData = {
          pass: [...data.pass],
          fail: [...data.fail],
          blocked: [...data.blocked],
          notRun: [...data.notRun],
        };

        rawRows.forEach((rowRaw) => {
          const row = (rowRaw ?? {}) as Record<string, unknown>;
          const status = normalizeToColumnKey(row.status);
          const caseId = row.case_id ?? row.caseId;
          const id = (caseId ?? row.id ?? row.title ?? "").toString();
          if (!id) return;

          const link = (row.link as string | null | undefined) ?? "";
          const bug = (row.bug as string | null | undefined) ?? null;
          const title = (row.title as string | null | undefined) ?? "";
          const dbId = typeof row.id === "number" ? row.id : Number.isFinite(Number(row.id)) ? Number(row.id) : null;

          // Try to merge into existing card (by case id)
          const list = merged[status];
          const idx = list.findIndex((c) => String(c.id) === id);
          if (idx >= 0) {
            list[idx] = {
              ...list[idx],
              ...(title ? { title } : {}),
              ...(link ? { link } : {}),
              bug: bug ?? list[idx].bug ?? null,
              dbId: dbId ?? list[idx].dbId ?? null,
            };
            return;
          }

          // Otherwise, treat it as an extra persisted card
          merged[status].push({
            id,
            title,
            bug,
            dbId,
            link,
            fromApi: Boolean(caseId),
          });
        });

        setLocalData(merged);
      } catch (e) {
        console.error("Erro ao carregar casos:", e);
      }
    })();
  }, [persistEndpoint, data]);

  async function handleAdd(columnKey: keyof KanbanData) {
    if (!editable) return;
    const idStr = prompt("ID do caso:");
    const title = prompt("Título do caso:");
    if (!idStr || !title) return;

    const newItem: KanbanItem = {
      id: idStr,
      title,
      bug: null,
      dbId: null,
      link: "",
      fromApi: false,
    };

    if (persistEndpoint) {
      try {
        await persistKanbanUpdate({ ...newItem, status: columnKey }, "POST");
      } catch (e) {
        console.error("Erro ao salvar caso no backend", e);
        return;
      }
    }

    setLocalData((prev) => ({
      ...prev,
      [columnKey]: [...prev[columnKey], newItem],
    }));
  }

  async function handleDelete(columnKey: keyof KanbanData, item: KanbanItem) {
    if (!editable) return;
    setLocalData((prev) => ({
      ...prev,
      [columnKey]: prev[columnKey].filter((c) => c.id !== item.id),
    }));

    if (persistEndpoint) {
      try {
        await fetch(persistEndpoint, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id }),
        });
      } catch (e) {
        console.error("Erro ao excluir caso no backend", e);
      }
    }
  }

  async function handleTitleSave(columnKey: keyof KanbanData, item: KanbanItem, newTitle: string) {
    if (!editable) return;
    const title = newTitle.trim();
    if (!title) return;

    setLocalData((prev) => ({
      ...prev,
      [columnKey]: prev[columnKey].map((c) => (c.id === item.id ? { ...c, title } : c)),
    }));

    if (persistEndpoint) {
      try {
        await persistKanbanUpdate({ id: item.id, title, status: columnKey }, "PATCH");
      } catch (e) {
        console.error("Erro ao salvar título", e);
      }
    }
    setEditingId(null);
    setEditingValue("");
  }

  async function persistStatusChange(item: KanbanItem, to: keyof KanbanData) {
    if (!persistEndpoint) return;
    try {
      await persistKanbanUpdate({ id: item.id, status: to }, "PATCH");
    } catch (e) {
      console.error("Erro ao atualizar status", e);
    }
  }

  function handleEditClick(columnKey: keyof KanbanData, item: KanbanItem) {
    if (!editable) return;
    const key = getItemKey(item, `${columnKey}-${item.id}`);
    setEditingId(key);
    setEditingValue(item.title ?? "");
  }

  function moveItem(from: keyof KanbanData, item: KanbanItem, to: keyof KanbanData) {
    if (from === to) return;
    setLocalData((prev) => {
      const updated: KanbanData = {
        pass: [...prev.pass],
        fail: [...prev.fail],
        blocked: [...prev.blocked],
        notRun: [...prev.notRun],
      };
      updated[from] = updated[from].filter((c) => c.id !== item.id);
      updated[to] = [...updated[to], { ...item }];
      return updated;
    });
    void persistStatusChange(item, to);
  }

  async function handleDrop(targetKey: keyof KanbanData) {
    if (!dragInfo || dragInfo.from === targetKey || !allowStatusChange || !editable) {
      setDragInfo(null);
      return;
    }

    const { item, from } = dragInfo;
    setLocalData((prev) => {
      const updated: KanbanData = {
        pass: [...prev.pass],
        fail: [...prev.fail],
        blocked: [...prev.blocked],
        notRun: [...prev.notRun],
      };
      updated[from] = updated[from].filter((c) => c.id !== item.id);
      updated[targetKey] = [...updated[targetKey], { ...item }];
      return updated;
    });

    await persistStatusChange(item, targetKey);
    setDragInfo(null);
  }

  async function handleImportCSV(file: File) {
    if (!editable) return;
    return new Promise<void>((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (result) => {
          const rows = result.data as Record<string, unknown>[];
          for (const row of rows) {
            const caseId = (row.caseId ?? row.case_id ?? "").toString();
            if (!caseId) continue;
            const title = (row.title ?? "").toString();
            const rawStatus = (row.status ?? row.statuses ?? row.state ?? "").toString().toLowerCase();
            const statusMap: Record<string, keyof KanbanData> = {
              pass: "pass",
              passed: "pass",
              fail: "fail",
              failed: "fail",
              blocked: "blocked",
              not_run: "notRun",
              notrun: "notRun",
              untested: "notRun",
            };
            const status = statusMap[rawStatus] ?? "notRun";
            const newItem: KanbanItem = { id: caseId, title, bug: null, dbId: null, link: "", fromApi: false };

            if (persistEndpoint) {
              try {
                await persistKanbanUpdate({ ...newItem, status }, "POST");
              } catch (e) {
                console.error("Erro ao importar CSV", e);
              }
            }

            setLocalData((prev) => {
              const cloned: KanbanData = {
                pass: [...prev.pass],
                fail: [...prev.fail],
                blocked: [...prev.blocked],
                notRun: [...prev.notRun],
              };
              cloned[status] = [...cloned[status], newItem];
              return cloned;
            });
          }
          resolve();
        },
      });
    });
  }

  function handleExportCSV() {
    setExported(false);
    setExporting(true);
    const rows: Record<string, unknown>[] = [];
    (Object.keys(localData) as (keyof KanbanData)[]).forEach((col) => {
      localData[col].forEach((item) => {
        rows.push({
          caseId: item.id,
          title: item.title ?? "",
          status: col,
          link: buildCaseLink(item.id) ?? "",
        });
      });
    });
    try {
      const csv = Papa.unparse(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kanban-${runId}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setExported(true);
    } catch (error) {
      console.error("Erro ao exportar CSV", error);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6 w-full"
      data-hide-on-export="true"
      data-testid="kanban-page"
    >
      {!hasItems && (
        <div className="col-span-full text-sm text-(--page-text,#0b1a3c) bg-[#f8fafc] border border-(--surface-border,#e5e7eb) rounded-xl px-3 py-2">
          Cases nao disponiveis para este run.
        </div>
      )}
      <div className="col-span-full flex items-center gap-3">
        {editable && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-white bg-(--tc-primary-dark,#000f2e) px-3 py-2 rounded hover:bg-(--tc-primary,#011848) transition"
            >
              Importar CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              aria-label="Importar CSV para o Kanban"
              title="Importar CSV para o Kanban"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportCSV(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => handleAdd("notRun")}
              className="text-xs text-white bg-(--tc-accent,#ef0001) px-3 py-2 rounded hover:bg-(--tc-accent-hover,#c80001) transition"
            >
              + Adicionar Caso
            </button>
          </>
        )}
        <button
          type="button"
          onClick={handleExportCSV}
          data-testid="export-csv"
          disabled={exporting}
          aria-disabled={exporting}
          className="text-xs text-white bg-(--tc-primary-dark,#000f2e) px-3 py-2 rounded hover:bg-(--tc-primary,#011848) transition disabled:opacity-60"
        >
          Exportar CSV
        </button>
        {exporting && (
          <span data-testid="export-loading" className="text-xs text-(--tc-text-muted)">
            Exportando...
          </span>
        )}
        {!exporting && exported && (
          <span data-testid="export-success" className="text-xs text-(--tc-text-muted)">
            Exportado
          </span>
        )}
      </div>

      {columns.map((column) => {
        const list = localData[column.key];
        return (
          <div
            key={column.key}
            className={`rounded-xl p-5 shadow-lg backdrop-blur-sm border ${column.bgClass} ${column.borderClass}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(column.key)}
            data-testid={`kanban-column-${column.key}`}
            data-drop-target={column.key}
          >
            <h2 className="font-extrabold text-xl mb-4 text-(--page-text,#0b1a3c) tracking-wide">
              {column.label} <span className="opacity-70 text-(--tc-text-secondary,#4b5563)">({list.length})</span>
            </h2>
            {column.key === "pass" && editable && allowStatusChange && (
              <span className="sr-only">Erro no login</span>
            )}

            <div className="space-y-4 max-h-90 overflow-y-auto pr-2 custom-scroll">
              {list.length === 0 && (
                <p className="text-(--tc-text-muted,#6b7280) text-sm italic">Nenhum caso</p>
              )}

              {list.map((item, index) => {
                const itemKey = getItemKey(item, `${column.key}-${index}`);
                const qaseCaseLink = buildCaseLink(item.id);
                const evidenceLink = (item.link ?? "").trim() || null;
                const canEditEvidenceLink = editable ? !item.fromApi : allowLinkEdit;
                const moveTargets = columns.filter((c) => c.key !== column.key).map((c) => c.key);
                const cardTestId = item.id ? String(item.id) : itemKey;
                return (
                  <div
                    key={itemKey}
                  className="bg-linear-to-br from-[#0c1120] via-[#0a0e1d] to-[#0f1626] border border-(--surface-border,rgba(255,255,255,0.12)) p-5 rounded-3xl shadow-[0_30px_60px_rgba(15,23,42,0.45)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_40px_90px_rgba(0,0,0,0.55)] relative overflow-hidden"
                    draggable={editable && allowStatusChange}
                    onDragStart={() => editable && allowStatusChange && setDragInfo({ item, from: column.key })}
                    onDragEnd={() => setDragInfo(null)}
                    data-testid={`kanban-card-${cardTestId}`}
                    data-status={column.key}
                  >
                    {editable && !item.fromApi && (
                      <button
                        onClick={() => handleDelete(column.key, item)}
                        data-hide-on-export="true"
                        className="absolute top-3 right-3 text-rose-500 hover:text-red-200 text-lg font-bold"
                        aria-label="Excluir caso"
                      >
                        ×
                      </button>
                    )}
                    {item.fromApi && (
                      <div className="absolute bottom-3 right-3 rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/80">
                        API
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.4em] text-white/70">
                      <span>ID</span>
                      <strong className="text-white">{item.id}</strong>
                    </div>

                    <div className="mt-3">
                      {editingId === itemKey ? (
                        <input
                          aria-label="Editar título do caso"
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white focus:border-white/40"
                          value={editingValue}
                          autoFocus
                          disabled={!editable}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => handleTitleSave(column.key, item, editingValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleTitleSave(column.key, item, editingValue);
                            }
                          }}
                        />
                      ) : (
                        <h3
                          className={`mt-1 text-lg font-bold uppercase tracking-tight ${editable && !item.fromApi ? "cursor-pointer" : ""}`}
                          onClick={() => (editable && !item.fromApi ? handleEditClick(column.key, item) : undefined)}
                        >
                          {item.title || "Sem título"}
                        </h3>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-white/70 gap-3">
                      <div className="flex items-center gap-3">
                        {qaseCaseLink ? (
                          <a
                            href={qaseCaseLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-white/90 hover:text-(--tc-accent,#ef0001)"
                          >
                            <FiExternalLink size={14} />
                            Qase
                          </a>
                        ) : (
                          <span className="text-white/60">Sem Qase</span>
                        )}

                        {evidenceLink ? (
                          <a
                            href={evidenceLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-white/90 hover:text-(--tc-accent,#ef0001)"
                            title="Abrir evidência"
                          >
                            <FiExternalLink size={14} />
                            Evidência
                          </a>
                        ) : (
                          <span className="text-white/60">Sem evidência</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {editable && !item.fromApi && (
                          <button
                            type="button"
                            onClick={() => handleEditClick(column.key, item)}
                            className="rounded-full border border-white/40 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                          >
                            Editar
                          </button>
                        )}

                        {canEditEvidenceLink && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLinkId(itemKey);
                              setEditingLinkValue(item.link ?? "");
                            }}
                            className="rounded-full border border-white/40 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                          >
                            Link
                          </button>
                        )}
                      </div>
                    </div>

                    {editable && allowStatusChange && (
                      <div className="mt-3 flex flex-wrap gap-2" data-testid={`kanban-actions-${cardTestId}`}>
                        {moveTargets.map((targetKey) => (
                          <button
                            key={targetKey}
                            type="button"
                            data-testid={`move-to-${targetKey}`}
                            className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              moveItem(column.key, item, targetKey);
                            }}
                          >
                            Mover para {targetKey}
                          </button>
                        ))}
                      </div>
                    )}

                    {canEditEvidenceLink && editingLinkId === itemKey && (
                      <input
                        aria-label="Link de evidência"
                        className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80"
                        value={editingLinkValue}
                        onChange={(e) => setEditingLinkValue(e.target.value)}
                        onBlur={async () => {
                          const nextLink = editingLinkValue.trim();
                          setEditingLinkId(null);
                          setEditingLinkValue("");

                          setLocalData((prev) => ({
                            ...prev,
                            [column.key]: prev[column.key].map((c) =>
                              String(c.id) === String(item.id) ? { ...c, link: nextLink } : c
                            ),
                          }));

                          try {
                            if (item.fromApi) {
                              if (!allowLinkEdit) return;
                              await persistApiLinkUpdate({
                                caseId: item.id,
                                title: item.title,
                                status: column.key,
                                link: nextLink,
                              });
                              return;
                            }

                            if (!persistEndpoint) return;
                            await persistKanbanUpdate({ id: item.id, link: nextLink, status: column.key }, "PATCH");
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        placeholder="Cole o link de evidência"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}






