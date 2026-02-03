"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";

type TicketStatus = "open" | "in_progress" | "closed";

type TicketItem = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  companySlug?: string | null;
};

const STATUS_OPTIONS: Array<{ value: TicketStatus; label: string }> = [
  { value: "open", label: "Aberto" },
  { value: "in_progress", label: "Em andamento" },
  { value: "closed", label: "Fechado" },
];

export default function AdminChamadosPage() {
  const [items, setItems] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tickets", { credentials: "include", cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { items?: TicketItem[]; error?: string };
      if (!res.ok) {
        setItems([]);
        setError(json?.error || "Erro ao carregar chamados");
        return;
      }
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar chamados";
      setItems([]);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  async function updateStatus(id: string, status: TicketStatus) {
    setUpdatingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Erro ao atualizar status");
        return;
      }
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar status";
      setError(msg);
    } finally {
      setUpdatingId(null);
    }
  }

  async function createTicket() {
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, description }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Erro ao criar chamado");
        return;
      }
      setTitle("");
      setDescription("");
      setMessage("Chamado criado.");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar chamado";
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <RequireGlobalAdmin>
      <div className="p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Chamados (Dev)</h1>
          <p className="text-sm text-(--tc-text-muted,#6b7280)">
            Gerencie todos os chamados e atualize o status para os solicitantes.
          </p>
        </header>

        <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Novo chamado</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-(--tc-text) flex flex-col gap-1">
              Titulo
              <input
                className="rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Acesso ao ambiente"
              />
            </label>
            <label className="text-sm text-(--tc-text) flex flex-col gap-1 md:col-span-2">
              Descricao
              <textarea
                rows={3}
                className="rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o chamado..."
              />
            </label>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="button"
                onClick={createTicket}
                disabled={creating}
                className="rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {creating ? "Criando..." : "Criar chamado"}
              </button>
            </div>
          </div>
          {message && <p className="text-sm text-green-600">{message}</p>}
        </section>

        <section className="rounded-2xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Todos os chamados</h2>
              <p className="text-sm text-(--tc-text-muted,#6b7280)">
                Atualize status para refletir no solicitante.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs uppercase tracking-[0.2em] text-(--tc-text-muted,#6b7280)">
                Filtro
              </label>
              <select
                className="rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "all")}
              >
                <option value="all">Todos</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={load}
                className="rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm"
                disabled={loading}
              >
                Atualizar
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {loading && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando...</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhum chamado encontrado.</p>
          )}

          <div className="grid gap-3">
            {filtered.map((item) => (
              <div key={item.id} className="rounded-xl border border-(--tc-border,#e5e7eb) p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-(--tc-text-muted,#6b7280)">
                      {new Date(item.createdAt).toLocaleString("pt-BR")} • {item.createdByName || item.createdByEmail || item.createdBy}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-lg border border-(--tc-border,#e5e7eb) bg-white px-3 py-2 text-xs"
                      value={item.status}
                      onChange={(e) => updateStatus(item.id, e.target.value as TicketStatus)}
                      disabled={updatingId === item.id}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-sm text-(--tc-text-secondary,#4b5563) whitespace-pre-wrap">
                  {item.description || "Sem descricao."}
                </p>
                {item.companySlug && (
                  <p className="text-xs text-(--tc-text-muted,#6b7280)">Empresa: {item.companySlug}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </RequireGlobalAdmin>
  );
}
