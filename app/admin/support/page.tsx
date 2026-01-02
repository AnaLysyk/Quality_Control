"use client";

import { useEffect, useState } from "react";

type SupportItem = {
  id: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
  admin_notes?: string | null;
};

export default function AdminSupportPage() {
  const [items, setItems] = useState<SupportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/support/access-request", { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message || "Erro ao carregar solicitações");
        return;
      }
      const body = await res.json();
      setItems(body.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: "in_progress" | "closed") {
    setUpdatingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/support/access-request/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message || "Erro ao atualizar");
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setUpdatingId(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Solicitações de Acesso/Suporte</h1>
          <p className="text-sm text-gray-600">Apenas admins visualizam este painel.</p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50"
          disabled={loading}
        >
          Atualizar
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-600">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-600">Nenhuma solicitação encontrada.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {new Date(item.created_at).toLocaleString()} — {item.email}
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    item.status === "closed"
                      ? "bg-green-100 text-green-700"
                      : item.status === "in_progress"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-gray-800 mt-2">{item.message}</pre>
              {item.admin_notes && (
                <div className="mt-2 text-xs text-gray-600">Notas do admin: {item.admin_notes}</div>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => updateStatus(item.id, "in_progress")}
                  disabled={updatingId === item.id}
                  className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-60"
                >
                  Em andamento
                </button>
                <button
                  onClick={() => updateStatus(item.id, "closed")}
                  disabled={updatingId === item.id}
                  className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-60"
                >
                  Fechar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
