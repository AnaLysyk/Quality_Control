"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { safeFetchJson, SafeFetchJsonError } from "@/lib/safeFetchJson";
 
// Helper para checar se foco está em input/editável
function isTypingTarget(el: Element | null) {
  if (!el) return false;
  const tag = (el as HTMLElement).tagName?.toLowerCase();
  const editable = (el as HTMLElement).isContentEditable;
  return editable || tag === "input" || tag === "textarea" || tag === "select";
}
// ...existing code...
// Fila de moves por card
type BasePath = "/api/chamados" | "/api/suportes";

async function fetchById(bp: BasePath, id: string) {
  return safeFetchJson<SuporteItem>(`${bp}/${id}`,
    {
      noStore: true,
      friendlyMessage: "Não foi possível revalidar o item",
    }
  );
}



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
// async function detectBasePath(): Promise<"/api/chamados" | "/api/suportes"> {
//   try {
//     await safeFetchJson("/api/chamados", { method: "HEAD", noStore: true });
//     return "/api/chamados";
//   } catch (e) {
//     if (e instanceof SafeFetchJsonError && e.status === 404) {
//       return "/api/suportes";
//     }
//     throw e;
//   }
// }

async function fetchSuportes(basePath: string): Promise<SuporteItem[]> {
  const data = await safeFetchJson<ApiList<SuporteItem>>(basePath, {
    noStore: true,
    friendlyMessage: "Não foi possível carregar suportes",
  });
  return data.items ?? [];
}


// async function patchStatus(basePath: string, id: string, next: ColumnKey): Promise<void> {
//   const body = { status: denormalizeStatus(next) };
//   await safeFetchJson(`${basePath}/${id}/status`, {
//     method: "PATCH",
//     noStore: true,
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(body),
//     friendlyMessage: "Não foi possível atualizar o status",
//   });
// }

function moveTarget(current: ColumnKey, dir: -1 | 1): ColumnKey {
  const idx = COLUMNS.findIndex((c) => c.key === current);
  const nextIdx = Math.max(0, Math.min(COLUMNS.length - 1, idx + dir));
  return COLUMNS[nextIdx].key;
}



export default function Page() {
    // ...existing code...
    // ...existing code...
  // State declarations
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SuporteItem | null>(null);
  const moveQueueRef = useMemo(() => new Map<string, Promise<void>>(), []);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);
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
  const moveOptimistic = useCallback(
    async (id: string, dir: -1 | 1) => {
      await enqueueMove(id, async () => {
        const currentItem = items.find((x: SuporteItem) => x.id === id);
        if (!currentItem) return;
        const from = normalizeStatus(currentItem.status);
        const to = moveTarget(from, dir);
        if (from === to) return;
        setErrorById((m) => {
          const { [id]: _, ...rest } = m;
          return rest;
        });
        const prev = items;
        setItems((cur) => cur.map((x: SuporteItem) => (x.id === id ? { ...x, status: to } : x)));
        setSavingById((m) => ({ ...m, [id]: true }));
        try {
          await patchStatus(id, to);
          const bp = await detectBasePath();
          try {
            const fresh = await fetchById(bp, id);
            setItems((cur) => cur.map((x: SuporteItem) => (x.id === id ? fresh : x)));
            showToast("Status atualizado ✅");
          } catch {
            await loadSuportes();
            showToast("Status atualizado ✅");
          }
        } catch (e: unknown) {
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

  // Atalhos de teclado para mover card selecionado e abrir modal
  // End of Page component
}
