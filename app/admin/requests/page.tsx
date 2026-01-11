"use client";

import { useEffect, useMemo, useState } from "react";

type RequestRecord = {
  id: string;
  userName: string;
  userEmail: string;
  companyName: string;
  type: "EMAIL_CHANGE" | "COMPANY_CHANGE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  payload: Record<string, any>;
  createdAt: string;
  reviewNote?: string;
};

export default function AdminRequestsPage() {
  const [items, setItems] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return items.filter(
      (req) =>
        (!status || req.status === status) &&
        (!type || req.type === type)
    );
  }, [items, status, type]);

  async function load() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/requests");
      if (res.status === 403) {
        setMessage("Sem permissão (faça login como admin)");
        setItems([]);
        return;
      }
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      setMessage("Erro ao carregar solicitações");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function update(id: string, next: "APPROVED" | "REJECTED") {
    setMessage(null);
    const res = await fetch(`/api/admin/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMessage(err.message || "Erro ao atualizar");
      return;
    }
    await load();
  }

  return (
    <div className="min-h-screen bg-white text-[#0b1a3c] px-6 py-10 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Solicitações (Admin)</h1>
          <p className="text-sm text-gray-600">Aprovar ou rejeitar pedidos de alteração</p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
          disabled={loading}
        >
          Atualizar
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select
          aria-label="Filtrar solicitações por status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-[#e5e7eb] rounded-lg px-3 py-2"
        >
          <option value="">Status (todos)</option>
          <option value="PENDING">Pendente</option>
          <option value="APPROVED">Aprovado</option>
          <option value="REJECTED">Rejeitado</option>
        </select>

        <select
          aria-label="Filtrar solicitações por tipo"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border border-[#e5e7eb] rounded-lg px-3 py-2"
        >
          <option value="">Tipo (todos)</option>
          <option value="EMAIL_CHANGE">Email</option>
          <option value="COMPANY_CHANGE">Empresa</option>
        </select>
      </div>

      {message && <p className="text-sm text-red-600">{message}</p>}
      {loading && <p className="text-sm text-gray-600">Carregando...</p>}

      <div className="space-y-2">
        {filtered.length === 0 && !loading && <p className="text-sm text-gray-600">Nenhuma solicitação.</p>}
        {filtered.map((req) => (
          <div key={req.id} className="rounded-lg border border-[#e5e7eb] p-3 flex flex-col gap-2">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold">{req.userName} ({req.userEmail})</p>
                <p className="text-sm text-gray-600">{req.companyName}</p>
              </div>
              <div className="text-sm font-bold">
                {req.status === "PENDING" && <span className="text-yellow-600">Pendente</span>}
                {req.status === "APPROVED" && <span className="text-green-600">Aprovado</span>}
                {req.status === "REJECTED" && <span className="text-red-600">Rejeitado</span>}
              </div>
            </div>
            <div className="text-sm text-gray-700">
              {req.type === "EMAIL_CHANGE" && <div>Solicitou email: {req.payload?.newEmail}</div>}
              {req.type === "COMPANY_CHANGE" && <div>Solicitou empresa: {req.payload?.newCompanyName}</div>}
              <div>Criado em {new Date(req.createdAt).toLocaleString()}</div>
              {req.reviewNote && <div>Nota: {req.reviewNote}</div>}
            </div>
            {req.status === "PENDING" && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => update(req.id, "APPROVED")}
                  className="rounded-lg bg-green-600 text-white px-3 py-1 text-sm"
                >
                  Aprovar
                </button>
                <button
                  onClick={() => update(req.id, "REJECTED")}
                  className="rounded-lg bg-red-600 text-white px-3 py-1 text-sm"
                >
                  Rejeitar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
