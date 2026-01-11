"use client";

import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
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
  runSlug?: string;
  persistEndpoint?: string;
  editable?: boolean;
  allowStatusChange?: boolean;
};

export default function Kanban({
  data,
  project,
  runId,
  qaseProject,
  persistEndpoint,
  editable = false,
  allowStatusChange = false,
}: KanbanProps) {
  const [localData, setLocalData] = useState<KanbanData>(data);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const projectAbbr = (qaseProject || project || "").toUpperCase();

  const hasItems =
    localData.pass.length ||
    localData.fail.length ||
    localData.blocked.length ||
    localData.notRun.length;

  const getItemKey = (item: KanbanItem, fallback: string) =>
    item.dbId ? `db-${item.dbId}` : item.id ? `case-${item.id}` : fallback;

  function buildCaseLink(caseId?: number | string | null) {
    if (!caseId || !projectAbbr) return null;
    return `https://app.qase.io/case/${projectAbbr}/${caseId}`;
  }

  type KanbanPayload = Record<string, unknown>;

  async function persistKanbanUpdate(payload: KanbanPayload, method: "POST" | "PATCH" = "PATCH") {
    const endpoint = persistEndpoint || "/api/kanban";
    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Falha ao salvar");
    return res.json();
  }

  // Carrega casos persistidos (manual)
  useEffect(() => {
    if (!persistEndpoint) return;

    (async () => {
      try {
        const res = await fetch(persistEndpoint, { cache: "no-store" });
        if (!res.ok) return;
        const rows = await res.json();
        if (!Array.isArray(rows)) return;

        const extra: KanbanData = {
          pass: [],
          fail: [],
          blocked: [],
          notRun: [],
        };

        rows.forEach((row: Record<string, unknown>) => {
          const item: KanbanItem = {
            id: (row.id ?? row.case_id ?? row.title ?? "").toString(),
            title: (row.title as string) ?? "",
            bug: (row.bug as string) || null,
            dbId: typeof row.dbId === "number" ? row.dbId : null,
            link: (row.link as string) ?? "",
            fromApi: Boolean(row.fromApi),
          };
          const status = (row.status as keyof KanbanData) || "notRun";
          if (extra[status]) {
            extra[status].push(item);
          }
        });

        setLocalData(extra);
      } catch (e) {
        console.error("Erro ao carregar casos:", e);
      }
    })();
  }, [persistEndpoint]);

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
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kanban-${runId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6 w-full" data-hide-on-export="true">
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
          className="text-xs text-white bg-(--tc-primary-dark,#000f2e) px-3 py-2 rounded hover:bg-(--tc-primary,#011848) transition"
        >
          Exportar CSV
        </button>
      </div>

      {columns.map((column) => {
        const list = localData[column.key];
        return (
          <div
            key={column.key}
            className={`rounded-xl p-5 shadow-lg backdrop-blur-sm border ${column.bgClass} ${column.borderClass}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(column.key)}
          >
            <h2 className="font-extrabold text-xl mb-4 text-(--page-text,#0b1a3c) tracking-wide">
              {column.label} <span className="opacity-70 text-(--tc-text-secondary,#4b5563)">({list.length})</span>
            </h2>

            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2 custom-scroll">
              {list.length === 0 && (
                <p className="text-(--tc-text-muted,#6b7280) text-sm italic">Nenhum caso</p>
              )}

              {list.map((item, index) => (
                <div
                  key={getItemKey(item, `${column.key}-${index}`)}
                  className="bg-(--tc-surface-dark,#0f1828) border border-(--surface-border,rgba(255,255,255,0.08)) p-4 rounded-lg shadow hover:shadow-md transition-all relative"
                  draggable={editable && allowStatusChange}
                  onDragStart={() => editable && allowStatusChange && setDragInfo({ item, from: column.key })}
                  onDragEnd={() => setDragInfo(null)}
                >
                  {editable && (
                    <button
                      onClick={() => handleDelete(column.key, item)}
                      data-hide-on-export="true"
                      className="absolute top-2 right-2 text-(--tc-accent,#ef0001) hover:text-(--tc-accent-hover,#c80001) text-sm font-bold"
                    >
                      ×
                    </button>
                  )}

                  <p className="text-xs text-(--tc-text-muted,#6b7280) font-bold mb-1">
                    ID:{" "}
                    {buildCaseLink(item.id) ? (
                      <a
                        href={buildCaseLink(item.id) as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-(--tc-primary,#011848)"
                      >
                        {item.id}
                      </a>
                    ) : (
                      item.id
                    )}
                  </p>

                  {editingId === getItemKey(item, `${column.key}-${index}`) ? (
                    <input
                      aria-label="Editar título do caso"
                      className="w-full bg-(--tc-surface-muted,#0f1626) text-(--tc-text-inverse,#ffffff) text-sm rounded px-2 py-1 border border-(--surface-border,rgba(255,255,255,0.08))"
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
                    <p
                      className={`font-semibold text-(--tc-text-inverse,#ffffff) text-sm ${editable ? "cursor-text" : ""}`}
                      onClick={() => {
                        if (!editable) return;
                        setEditingId(getItemKey(item, `${column.key}-${index}`));
                        setEditingValue(item.title ?? "");
                      }}
                    >
                      {item.title}
                    </p>
                  )}

                  {item.bug && (
                    <p className="text-xs text-(--tc-accent,#ef0001) mt-1">
                      Bug: {item.bug}
                    </p>
                  )}
                  {editable && (
                    <input
                      aria-label="Link de evidência"
                      className="w-full mt-2 bg-(--tc-surface-muted,#0f1626) text-(--tc-text-inverse,#ffffff) text-sm rounded px-2 py-1 border border-(--surface-border,rgba(255,255,255,0.08))"
                      value={item.link ?? ""}
                      onChange={(e) =>
                        setLocalData((prev) => ({
                          ...prev,
                          [column.key]: prev[column.key].map((c) =>
                            c.id === item.id ? { ...c, link: e.target.value } : c
                          ),
                        }))
                      }
                      onBlur={() => {
                        if (!persistEndpoint) return;
                        persistKanbanUpdate({ id: item.id, link: item.link, status: column.key }, "PATCH").catch((e) =>
                          console.error(e)
                        );
                      }}
                      placeholder="Link de evidência (opcional)"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}






