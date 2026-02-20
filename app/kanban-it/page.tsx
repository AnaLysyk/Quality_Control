// Helper para checar se foco está em input/editável
function isTypingTarget(el: Element | null) {
  if (!el) return false;
  const tag = (el as HTMLElement).tagName?.toLowerCase();
  const editable = (el as HTMLElement).isContentEditable;
  return editable || tag === "input" || tag === "textarea" || tag === "select";
}
// ...existing code...
// Fila de moves por card
import { useRef } from "react";
type BasePath = "/api/chamados" | "/api/suportes";

async function fetchById(bp: BasePath, id: string) {
  return safeFetchJson<SuporteItem>(`${bp}/${id}`,
    {
      noStore: true,
      friendlyMessage: "Não foi possível revalidar o item",
    }
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { safeFetchJson, SafeFetchJsonError } from "@/lib/safeFetchJson";


type SuporteItem = {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ApiList<T> = { items: T[] };

const COLUMNS = [
  { key: "BACKLOG", title: "Backlog" },
  { key: "IN_PROGRESS", title: "Em andamento" },
  { key: "DONE", title: "Concluído" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

function normalizeStatus(s?: string | null): ColumnKey {
  const v = (s ?? "").toUpperCase().trim();

  if (
    v === "IN_PROGRESS" ||
    v.includes("PROGRESS") ||
    v.includes("ANDAMENTO") ||
    v.includes("FAZENDO")
  )
    return "IN_PROGRESS";

  if (v === "DONE" || v.includes("DONE") || v.includes("CONCL") || v.includes("FECH"))
    return "DONE";

  return "BACKLOG";
}

function denormalizeStatus(col: ColumnKey) {
  // o que vai para o backend
  return col;
}


// Detecta e cacheia o endpoint base ("/api/chamados" ou "/api/suportes")
async function detectBasePath(): Promise<"/api/chamados" | "/api/suportes"> {
  try {
    await safeFetchJson("/api/chamados", { method: "HEAD", noStore: true });
    return "/api/chamados";
  } catch (e) {
    if (e instanceof SafeFetchJsonError && e.status === 404) {
      return "/api/suportes";
    }
    throw e;
  }
}

async function fetchSuportes(basePath: string): Promise<SuporteItem[]> {
  const data = await safeFetchJson<ApiList<SuporteItem>>(basePath, {
    noStore: true,
    friendlyMessage: "Não foi possível carregar suportes",
  });
  return data.items ?? [];
}


async function patchStatus(basePath: string, id: string, next: ColumnKey): Promise<void> {
  const body = { status: denormalizeStatus(next) };
  await safeFetchJson(`${basePath}/${id}/status`, {
    method: "PATCH",
    noStore: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    friendlyMessage: "Não foi possível atualizar o status",
  });
}

function moveTarget(current: ColumnKey, dir: -1 | 1): ColumnKey {
  const idx = COLUMNS.findIndex((c) => c.key === current);
  const nextIdx = Math.max(0, Math.min(COLUMNS.length - 1, idx + dir));
  return COLUMNS[nextIdx].key;
}



export default function Page() {
  // Fila de moves por card
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SuporteItem | null>(null);
    // ...existing code...

    // Atalhos de teclado para mover card selecionado e abrir modal
    useEffect(() => {
      const onKeyDown = async (ev: KeyboardEvent) => {
        if (isTypingTarget(document.activeElement)) return;
        if (!selectedId) return;
        if (ev.key === "ArrowLeft") {
          ev.preventDefault();
          void moveOptimistic(selectedId, -1);
        }
        if (ev.key === "ArrowRight") {
          ev.preventDefault();
          void moveOptimistic(selectedId, 1);
        }
        if (ev.key === "Enter") {
          if (savingById[selectedId]) return;
          ev.preventDefault();
          // Busca dados frescos e abre modal
          const bp = await detectBasePath();
          try {
            const fresh = await fetchById(bp, selectedId);
            setSelectedItem(fresh);
          } catch {
            // fallback: pega do state se fetch falhar
            const it = items.find((x) => x.id === selectedId) ?? null;
            setSelectedItem(it);
          }
        }
        if (ev.key === "Escape") {
          setSelectedItem(null);
        }
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [selectedId, moveOptimistic, detectBasePath, items, savingById]);
  const moveQueueRef = useMemo(() => new Map<string, Promise<void>>(), []);

  // Toast global
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  // Contador de pendências por card
  const [pendingById, setPendingById] = useState<Record<string, number>>({});

  const enqueueMove = useCallback(
    (id: string, task: () => Promise<void>) => {
      setPendingById((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }));
      const prev = moveQueueRef.get(id) ?? Promise.resolve();
      const next = prev
        .catch(() => {})
        .then(task)
        .finally(() => {
          setPendingById((m) => {
            const n = (m[id] ?? 1) - 1;
            if (n <= 0) {
              const { [id]: _, ...rest } = m;
              return rest;
            }
            return { ...m, [id]: n };
          });
          if (moveQueueRef.get(id) === next) moveQueueRef.delete(id);
        });
      moveQueueRef.set(id, next);
      return next;
    },
    [moveQueueRef],
  );

  const [items, setItems] = useState<SuporteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const [basePath, setBasePath] = useState<"/api/chamados" | "/api/suportes" | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  // Detecta basePath uma única vez e cacheia
  const detectBasePath = useCallback(async () => {
    if (basePath) return basePath;
    try {
      await safeFetchJson("/api/chamados", { noStore: true });
      setBasePath("/api/chamados");
      return "/api/chamados" as const;
    } catch (e) {
      if (e instanceof SafeFetchJsonError && e.status === 404) {
        setBasePath("/api/suportes");
        return "/api/suportes" as const;
      }
      setBasePath("/api/chamados");
      return "/api/chamados" as const;
    }
  }, [basePath]);

  // Carrega suportes usando basePath detectado
  const loadSuportes = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const bp = await detectBasePath();
      const data = await safeFetchJson<ApiList<SuporteItem>>(`${bp}`, {
        noStore: true,
        friendlyMessage: "Não foi possível carregar suportes",
      });
      setItems(data.items ?? []);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Erro ao carregar suportes");
    } finally {
      setLoading(false);
    }
  }, [detectBasePath]);

  useEffect(() => {
    void loadSuportes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const acc = COLUMNS.reduce<Record<ColumnKey, SuporteItem[]>>((a, c) => {
      a[c.key] = [];
      return a;
    }, {} as any);
    for (const it of items) {
      acc[normalizeStatus(it.status)].push(it);
    }
    return acc;
  }, [items]);

  // PATCH status usando basePath fixo
  const patchStatus = useCallback(async (id: string, next: ColumnKey) => {
    const bp = await detectBasePath();
    await safeFetchJson(`${bp}/${id}/status`, {
      method: "PATCH",
      noStore: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: denormalizeStatus(next) }),
      friendlyMessage: "Não foi possível atualizar o status",
    });
  }, [detectBasePath]);

  // Move otimista com fila por card
  const moveOptimistic = useCallback(
    async (id: string, dir: -1 | 1) => {
      await enqueueMove(id, async () => {
        const currentItem = items.find((x) => x.id === id);
        if (!currentItem) return;

        const from = normalizeStatus(currentItem.status);
        const to = moveTarget(from, dir);
        if (from === to) return;

        // limpa erro do card
        setErrorById((m) => {
          const { [id]: _, ...rest } = m;
          return rest;
        });

        // otimista
        const prev = items;
        setItems((cur) => cur.map((x) => (x.id === id ? { ...x, status: to } : x)));
        setSavingById((m) => ({ ...m, [id]: true }));

        try {
          await patchStatus(id, to);
          // revalidação individual
          const bp = await detectBasePath();
          try {
            const fresh = await fetchById(bp, id);
            setItems((cur) => cur.map((x) => (x.id === id ? fresh : x)));
            showToast("Status atualizado ✅");
          } catch {
            // fallback: recarrega tudo se GET por id falhar
            await loadSuportes();
            showToast("Status atualizado ✅");
          }
        } catch (e: unknown) {
          // rollback
          setItems(prev);
          const msg = e instanceof Error ? e.message : "Falha ao atualizar status";
          setErrorById((m) => ({ ...m, [id]: msg }));
        } finally {
          setSavingById((m) => ({ ...m, [id]: false }));
        }
      });
    },
    [enqueueMove, items, patchStatus, loadSuportes, detectBasePath, showToast],
  );

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Suportes</h1>
          <p className="text-sm text-slate-500">
            Visão completa do fluxo de suportes para desenvolvimento.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Dica: clique em um card e use ← → para mover
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadSuportes()}
            disabled={loading || !basePath}
            className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>

          <button
            type="button"
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-95"
          >
            Novo suporte
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => (
          <section
            key={col.key}
            className="rounded-2xl border bg-white p-3 shadow-sm"
          >
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-extrabold tracking-wide">{col.title}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {grouped[col.key].length}
              </span>
            </header>

            <div className="space-y-2">
              {grouped[col.key].map((it) => {
                const st = normalizeStatus(it.status);
                const busy = !!savingById[it.id];
                const err = errorById[it.id];
                const pend = pendingById[it.id];

                return (
                  <article
                    key={it.id}
                    onClick={() => setSelectedId(it.id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setSelectedId(it.id);
                    }}
                    className={[
                      "rounded-2xl border bg-white p-3 shadow-[0_8px_16px_rgba(15,23,42,0.06)]",
                      selectedId === it.id
                        ? "ring-2 ring-slate-900/40 border-slate-900/30"
                        : "hover:border-slate-300",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {it.title ?? "Sem título"}
                        </p>
                        {it.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                            {it.description}
                          </p>
                        ) : null}
                        <p className="mt-2 text-[11px] text-slate-500">
                          ID: {it.id}
                        </p>
                        {err ? (
                          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                            {err}
                          </div>
                        ) : null}
                        {pend ? (
                          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {pend} pendente
                          </span>
                        ) : null}
                        {selectedId === it.id ? (
                          <span className="ml-2 text-[10px] text-slate-400">Enter: abrir</span>
                        ) : null}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {st}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void moveOptimistic(it.id, -1)}
                            disabled={busy || st === "BACKLOG"}
                            className="rounded-lg border px-2 py-1 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40"
                            title="Mover para a coluna anterior"
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            onClick={() => void moveOptimistic(it.id, 1)}
                            disabled={busy || st === "DONE"}
                            className="rounded-lg border px-2 py-1 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40"
                            title="Mover para a próxima coluna"
                          >
                            →
                          </button>
                        </div>

                        {busy ? (
                          <span className="text-[10px] font-semibold text-slate-500">
                            Salvando…
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}

              {grouped[col.key].length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-center text-xs text-slate-500">
                  Sem itens
                </div>
              ) : null}
            </div>
          </section>
        ))}
      </div>
      {/* Toast global */}
      {toast ? (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl border bg-white px-4 py-2 text-sm font-semibold shadow-lg">
          {toast}
        </div>
      ) : null}

      {/* Modal de detalhes (placeholder) */}
      {selectedItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-xl bg-white p-6 shadow-xl min-w-[320px] max-w-[90vw]">
            <h2 className="text-lg font-bold mb-2">Detalhes do Suporte</h2>
            <pre className="text-xs bg-slate-50 rounded p-2 mb-4 overflow-x-auto">{JSON.stringify(selectedItem, null, 2)}</pre>
            <button
              className="mt-2 rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              onClick={() => setSelectedItem(null)}
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}



