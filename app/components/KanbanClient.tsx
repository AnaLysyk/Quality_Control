"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "react-hot-toast";

type Status = "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN";

type Card = {
  id: number;
  project: string;
  run_id?: number;
  case_id?: number | null;
  title?: string | null;
  status?: Status | null;
  bug?: string | null;
  link?: string | null;
  created_at?: string | null;
};

type Props = {
  project: string;
  runId: number;
  editable?: boolean;
  authToken?: string;
  onCreate?: (card?: Card | null) => void;
  onUpdate?: (card?: Card | null) => void;
  onDelete?: (id: number) => void;
};

const base = "/api/kanban";

export default function KanbanClient({ project, runId, editable = true, authToken, onCreate, onUpdate, onDelete }: Props) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyIds, setBusyIds] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newStatus, setNewStatus] = useState<Status>("NOT_RUN");
  const [newCaseId, setNewCaseId] = useState<number | undefined>(undefined);
  const [newBug, setNewBug] = useState("");
  const [newLink, setNewLink] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingBug, setEditingBug] = useState("");
  const [editingLink, setEditingLink] = useState("");

  const STATUSES: Status[] = useMemo(() => ["PASS", "FAIL", "BLOCKED", "NOT_RUN"], []);
  const authHeaders = useMemo<Record<string, string> | undefined>(
    () => (authToken ? { Authorization: `Bearer ${authToken}` } : undefined),
    [authToken]
  );

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}?project=${encodeURIComponent(project)}&runId=${runId}`, {
        cache: "no-store",
        headers: authHeaders,
      });
      if (res.status === 204) {
        setCards([]);
        setLoading(false);
        return;
      }
      const json = await res.json().catch(() => null);
      let items: Card[] = [];
      if (Array.isArray(json)) items = json as Card[];
      else if (json?.items && Array.isArray(json.items)) items = json.items as Card[];
      else if (json?.data && Array.isArray(json.data)) items = json.data as Card[];
      items.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return ta - tb;
      });
      setCards(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar cards";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [project, runId, authHeaders]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  async function createCard(payload: { title: string; status: Status; case_id?: number; bug?: string; link?: string }) {
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(authHeaders ?? {}) },
      body: JSON.stringify({ project, runId, ...payload }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Erro ao criar card${txt ? `: ${txt}` : ""}`);
    }
    return res.json().catch(() => null);
  }

  async function updateCard(id: number, payload: Partial<Card>) {
    const res = await fetch(`${base}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(authHeaders ?? {}) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Erro ao atualizar card${txt ? `: ${txt}` : ""}`);
    }
    return res.json().catch(() => null);
  }

  async function removeCard(id: number) {
    const res = await fetch(`${base}/${id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Erro ao remover card${txt ? `: ${txt}` : ""}`);
    }
    return res.json().catch(() => null);
  }

  async function moveCard(id: number, toStatus: Status) {
    if (!editable || busyIds[id]) return;
    const card = cards.find((c) => c.id === id);
    if (!card || (card.status ?? "NOT_RUN") === toStatus) return;

    const snapshot = cards.slice();
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status: toStatus } : c)));
    setBusyIds((b) => ({ ...b, [id]: true }));
    try {
      const updated = await updateCard(id, { status: toStatus });
      toast.success("Card movido");
      onUpdate?.(updated ?? { ...card, status: toStatus });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao mover card";
      setCards(snapshot);
      toast.error(message);
    } finally {
      setBusyIds((b) => {
        const copy = { ...b };
        delete copy[id];
        return copy;
      });
    }
  }

  function handleDragStart(e: React.DragEvent, cardId: number) {
    if (!editable) return;
    try {
      e.dataTransfer.setData("text/plain", String(cardId));
      e.dataTransfer.effectAllowed = "move";
    } catch {
      /* ignore */
    }
  }

  async function handleDrop(e: React.DragEvent, status: Status) {
    e.preventDefault();
    if (!editable) return;
    const idStr = e.dataTransfer.getData("text/plain");
    if (!idStr) return;
    moveCard(Number(idStr), status);
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = "move";
    } catch {
      /* ignore */
    }
  }

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!newTitle.trim()) {
      setError("Título é obrigatório");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const created = await createCard({
        title: newTitle.trim(),
        status: newStatus,
        case_id: newCaseId,
        bug: newBug || undefined,
        link: newLink || undefined,
      });
      setNewTitle("");
      setNewCaseId(undefined);
      setNewBug("");
      setNewLink("");
      setNewStatus("NOT_RUN");
      await loadCards();
      toast.success("Card criado");
      onCreate?.(created as Card);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(card: Card) {
    if (!editable) return;
    setEditingId(card.id ?? null);
    setEditingTitle(card.title ?? "");
    setEditingBug(card.bug ?? "");
    setEditingLink(card.link ?? "");
  }

  async function saveEdit() {
    if (!editingId) return;
    if (busyIds[editingId]) return;
    setError(null);
    const snapshot = cards.slice();
    setCards((prev) => prev.map((c) => (c.id === editingId ? { ...c, title: editingTitle, bug: editingBug, link: editingLink } : c)));
    setBusyIds((b) => ({ ...b, [editingId]: true }));
    try {
      const updated = await updateCard(editingId, { title: editingTitle, bug: editingBug, link: editingLink });
      toast.success("Card atualizado");
      onUpdate?.(updated ?? { ...cards.find((c) => c.id === editingId), title: editingTitle, bug: editingBug, link: editingLink } as Card);
      setEditingId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar";
      setCards(snapshot);
      toast.error(message);
    } finally {
      setBusyIds((b) => {
        const copy = { ...b };
        delete copy[editingId];
        return copy;
      });
    }
  }

  async function handleDelete(id: number) {
    if (!editable) return;
    if (!confirm("Confirma remoção do card?")) return;
    if (busyIds[id]) return;
    const snapshot = cards.slice();
    setCards((prev) => prev.filter((c) => c.id !== id));
    setBusyIds((b) => ({ ...b, [id]: true }));
    try {
      await removeCard(id);
      toast.success("Card removido");
      onDelete?.(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao remover";
      setCards(snapshot);
      toast.error(message);
    } finally {
      setBusyIds((b) => {
        const copy = { ...b };
        delete copy[id];
        return copy;
      });
    }
  }

  const columns = useMemo(
    () =>
      STATUSES.map((s) => ({
        status: s,
        title: s,
        items: cards.filter((c) => (c.status ?? "NOT_RUN") === s),
      })),
    [cards, STATUSES]
  );

  return (
    <div className="w-full p-4">
      <Toaster position="bottom-right" />
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-semibold">Kanban — {project} / run {runId}</h2>
        <button
          className="px-3 py-1 bg-indigo-600 text-white rounded disabled:opacity-50"
          onClick={() => loadCards()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      {editable && (
        <form className="mb-6 flex flex-wrap gap-3 items-end" onSubmit={handleCreate}>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-700" htmlFor="new-title">Título</label>
            <input
              id="new-title"
              className="w-full px-3 py-2 border rounded bg-white"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Título do case"
              required
            />
          </div>
          <div className="min-w-[140px] flex-1 sm:flex-none sm:w-32">
            <label className="block text-sm text-gray-700" htmlFor="new-status">Status</label>
            <select
              id="new-status"
              className="w-full px-3 py-2 border rounded bg-white"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as Status)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[120px] flex-1 sm:flex-none sm:w-28">
            <label className="block text-sm text-gray-700" htmlFor="new-case-id">Case ID</label>
            <input
              id="new-case-id"
              type="number"
              className="w-full px-3 py-2 border rounded bg-white"
              value={newCaseId ?? ""}
              onChange={(e) => setNewCaseId(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="opcional"
            />
          </div>
          <div className="min-w-[160px] flex-1 sm:flex-none sm:w-40">
            <label className="block text-sm text-gray-700" htmlFor="new-bug">Bug</label>
            <input
              id="new-bug"
              className="w-full px-3 py-2 border rounded bg-white"
              value={newBug}
              onChange={(e) => setNewBug(e.target.value)}
              placeholder="opcional"
            />
          </div>
          <div className="min-w-[160px] flex-1 sm:flex-none sm:w-40">
            <label className="block text-sm text-gray-700" htmlFor="new-link">Link</label>
            <input
              id="new-link"
              className="w-full px-3 py-2 border rounded bg-white"
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
              placeholder="opcional"
            />
          </div>
          <button type="submit" className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50" disabled={loading}>
            Criar
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {columns.map((col) => (
          <div
            key={col.status}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.status)}
            className="min-h-[220px] bg-white p-3 rounded border border-gray-200 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium text-[#0b1a3c]">{col.title}</h3>
              <span className="text-sm text-gray-500">{col.items.length}</span>
            </div>
            <div className="space-y-2">
              {col.items.map((card) => (
                <div
                  key={card.id}
                  draggable={editable}
                  onDragStart={(e) => editable && handleDragStart(e, card.id)}
                  className="bg-white p-3 rounded border border-gray-200 shadow-xs flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-[#0b1a3c]">{card.title ?? "—"}</div>
                      <div className="text-xs text-gray-500">
                        case: {card.case_id ?? "-"} • created: {card.created_at ? new Date(card.created_at).toLocaleString() : "-"}
                      </div>
                      {card.bug && <div className="text-xs text-red-600">Bug: {card.bug}</div>}
                      {card.link && (
                        <div className="text-xs">
                          <a className="text-indigo-600" href={card.link} target="_blank" rel="noreferrer">
                            Link
                          </a>
                        </div>
                      )}
                    </div>
                    {editable && (
                      <div className="flex flex-col items-end gap-2 text-xs">
                        <button className="text-blue-600" onClick={() => startEdit(card)}>
                          Editar
                        </button>
                        <button className="text-red-600" onClick={() => handleDelete(card.id)} disabled={!!busyIds[card.id]}>
                          Deletar
                        </button>
                        <div className="flex flex-wrap gap-1">
                          {STATUSES.map((st) => (
                            <button
                              key={st}
                              className="px-2 py-1 border rounded text-[11px] text-gray-600 hover:border-indigo-500"
                              onClick={() => moveCard(card.id, st)}
                              disabled={!!busyIds[card.id]}
                            >
                              Mover para {st}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {col.items.length === 0 && <div className="text-xs text-gray-400 italic">Sem cards</div>}
            </div>
          </div>
        ))}
      </div>

      {loading && <div className="mt-4 text-sm text-gray-500">Carregando...</div>}

      {editingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-lg max-h-[calc(100vh-3rem)] overflow-y-auto bg-white p-4 rounded shadow space-y-3">
            <h4 className="text-lg font-medium">Editar card</h4>
            <div className="space-y-2">
              <div>
                <label className="block text-sm text-gray-700" htmlFor="edit-title">Título</label>
                <input
                  id="edit-title"
                  className="w-full px-3 py-2 border rounded bg-white"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  placeholder="Título do card"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700" htmlFor="edit-bug">Bug</label>
                <input
                  id="edit-bug"
                  className="w-full px-3 py-2 border rounded bg-white"
                  value={editingBug}
                  onChange={(e) => setEditingBug(e.target.value)}
                  placeholder="Bug"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700" htmlFor="edit-link">Link</label>
                <input
                  id="edit-link"
                  className="w-full px-3 py-2 border rounded bg-white"
                  value={editingLink}
                  onChange={(e) => setEditingLink(e.target.value)}
                  placeholder="Link ou evidência"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 border rounded" onClick={() => setEditingId(null)}>
                Cancelar
              </button>
              <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={() => saveEdit()} disabled={!!(editingId && busyIds[editingId])}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
