"use client";

import { useEffect, useState } from "react";
import { KanbanData, KanbanItem } from "@/types/kanban";

interface KanbanProps {
  data: KanbanData; // vindo do Qase
  project: string;
  runId: number;
}

export default function Kanban({ data, project, runId }: KanbanProps) {
  const [localData, setLocalData] = useState<KanbanData>(data);

  const columns: {
    key: keyof KanbanData;
    label: string;
    bg: string;
    border: string;
  }[] = [
    { key: "pass", label: "Pass", bg: "bg-green-900/40", border: "border-green-700" },
    { key: "fail", label: "Fail", bg: "bg-red-900/40", border: "border-red-700" },
    { key: "blocked", label: "Blocked", bg: "bg-yellow-900/30", border: "border-yellow-700" },
    { key: "notRun", label: "Not Run", bg: "bg-gray-800/60", border: "border-gray-700" },
  ];

  // 🔹 Carrega extras do backend (o que foi salvo manualmente)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/kanban?project=${project}&runId=${runId}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          console.error(`Erro ${res.status}`);
          return;
        }

        const rows = await res.json();

        if (!Array.isArray(rows)) {
          console.error("Resposta inválida");
          return;
        }

        if (rows.length === 0) {
          console.log("Nenhum item salvo no backend");
          return;
        }

        const extra: KanbanData = {
          pass: [],
          fail: [],
          blocked: [],
          notRun: [],
        };

        rows.forEach((row: any) => {
          const item: KanbanItem = {
            id: row.case_id,
            title: row.title,
            bug: row.bug || null,
            dbId: row.id,
          };

          const status = (row.status as keyof KanbanData) || "notRun";
          if (extra[status]) {
            extra[status].push(item);
          }
        });

        // Combina Qase + extras do backend
        setLocalData({
          pass: [...data.pass, ...extra.pass],
          fail: [...data.fail, ...extra.fail],
          blocked: [...data.blocked, ...extra.blocked],
          notRun: [...data.notRun, ...extra.notRun],
        });
      } catch (e) {
        console.error("Erro ao carregar backend:", e);
        // Mantém dados do Qase
      }
    })();
  }, [project, runId, data]);

  // helper pra adicionar caso
  async function handleAdd(columnKey: keyof KanbanData) {
    const idStr = prompt("ID do caso:");
    const title = prompt("Título do caso:");

    if (!idStr || !title) return;
    const caseId = parseInt(idStr, 10);
    if (isNaN(caseId)) return;

    try {
      const res = await fetch("/api/kanban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: runId,
          project,
          case_id: caseId,
          title,
          status: columnKey,
          bug: null,
        }),
      });

      if (!res.ok) {
        console.error("Erro ao salvar");
        return;
      }

      const saved = await res.json();
      const dbRecord = Array.isArray(saved) ? saved[0] : saved;

      const newItem: KanbanItem = {
        id: caseId,
        title,
        bug: null,
        dbId: dbRecord?.id,
      };

      setLocalData((prev) => ({
        ...prev,
        [columnKey]: [...prev[columnKey], newItem],
      }));
    } catch (e) {
      console.error("Erro ao salvar caso no backend", e);
      alert("Erro ao salvar");
    }
  }

  // helper pra excluir caso
  async function handleDelete(columnKey: keyof KanbanData, item: KanbanItem) {
    setLocalData((prev) => ({
      ...prev,
      [columnKey]: prev[columnKey].filter((c) =>
        item.dbId ? c.dbId !== item.dbId : c.id !== item.id
      ),
    }));

    if (item.dbId) {
      try {
        await fetch("/api/kanban", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.dbId }),
        });
      } catch (e) {
        console.error("Erro ao excluir caso no backend", e);
      }
    }
  }

  return (
    <div className="grid grid-cols-4 gap-6 mt-6">
      {columns.map((column) => {
        const list = localData[column.key];

        return (
          <div
            key={column.key}
            className={`${column.bg} border ${column.border} rounded-xl p-5 shadow-lg backdrop-blur-sm`}
          >
            <h2 className="font-extrabold text-xl mb-4 text-white tracking-wide drop-shadow">
              {column.label} <span className="opacity-70">({list.length})</span>
            </h2>

            {/* ADICIONAR CASO */}
            <button
              onClick={() => handleAdd(column.key)}
              className="text-xs text-white bg-zinc-700 px-2 py-1 rounded hover:bg-zinc-600 transition mb-3"
            >
              + Adicionar Caso
            </button>

            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2 custom-scroll">
              {list.length === 0 && (
                <p className="text-gray-300 text-sm italic">Nenhum caso</p>
              )}

              {list.map((item, index) => (
                <div
                  key={item.dbId ?? item.id ?? `${column.key}-${index}`}
                  className="bg-zinc-900 border border-zinc-700 p-4 rounded-lg shadow hover:shadow-md transition-all relative"
                >
                  {/* EXCLUIR */}
                  <button
                    onClick={() => handleDelete(column.key, item)}
                    className="absolute top-2 right-2 text-red-400 hover:text-red-200 text-sm font-bold"
                  >
                    ×
                  </button>

                  <p className="text-xs text-gray-400 font-bold mb-1">
                    ID: {item.id}
                  </p>
                  <p className="font-semibold text-gray-200 text-sm">
                    {item.title}
                  </p>

                  {item.bug && (
                    <p className="text-xs text-red-400 mt-1">
                      Bug: {item.bug}
                    </p>
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
