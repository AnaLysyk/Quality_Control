"use client";

import { useEffect, useState } from "react";

type RequestRecord = {
  id: string;
  type: "EMAIL_CHANGE" | "COMPANY_CHANGE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  payload: Record<string, any>;
  createdAt: string;
  reviewNote?: string;
};

export default function RequestsPage() {
  const [items, setItems] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await fetch("/api/requests/me");
      const json = await res.json();
      setItems(json.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function submitEmail() {
    setMessage(null);
    const res = await fetch("/api/requests/email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMessage(err.message || "Erro ao enviar solicitação");
      return;
    }
    setEmail("");
    setMessage("Solicitação de email enviada");
    loadRequests();
  }

  async function submitCompany() {
    setMessage(null);
    const res = await fetch("/api/requests/company-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newCompanyName: company }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMessage(err.message || "Erro ao enviar solicitação");
      return;
    }
    setCompany("");
    setMessage("Solicitação de empresa enviada");
    loadRequests();
  }

  return (
    <div className="min-h-screen bg-white text-[#0b1a3c] px-6 py-10 space-y-6">
      <h1 className="text-3xl font-bold">Minhas solicitações</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#e5e7eb] p-4 space-y-3">
          <h2 className="text-lg font-semibold">Solicitar alteração de email</h2>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="novo@email.com"
            className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2"
          />
          <button
            onClick={submitEmail}
            className="rounded-lg bg-[#0b1a3c] text-white px-4 py-2"
            disabled={!email}
          >
            Enviar
          </button>
        </div>

        <div className="rounded-xl border border-[#e5e7eb] p-4 space-y-3">
          <h2 className="text-lg font-semibold">Solicitar alteração de empresa</h2>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Novo nome da empresa"
            className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2"
          />
          <button
            onClick={submitCompany}
            className="rounded-lg bg-[#0b1a3c] text-white px-4 py-2"
            disabled={!company}
          >
            Enviar
          </button>
        </div>
      </div>

      {message && <p className="text-sm text-[#0b1a3c]">{message}</p>}

      <div className="rounded-xl border border-[#e5e7eb] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Status</h2>
          {loading && <span className="text-sm text-gray-500">Carregando...</span>}
        </div>
        {items.length === 0 && <p className="text-sm text-gray-600">Nenhuma solicitação.</p>}
        <div className="space-y-2">
          {items.map((req) => (
            <div
              key={req.id}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg border border-[#e5e7eb] px-3 py-2"
            >
              <div>
                <p className="font-semibold">
                  {req.type === "EMAIL_CHANGE" ? "Troca de email" : "Troca de empresa"}
                </p>
                <p className="text-sm text-gray-600">
                  Criado em {new Date(req.createdAt).toLocaleString()}
                </p>
                {req.reviewNote && <p className="text-sm text-gray-600">Nota: {req.reviewNote}</p>}
              </div>
              <div className="text-sm font-bold">
                {req.status === "PENDING" && <span className="text-yellow-600">Pendente</span>}
                {req.status === "APPROVED" && <span className="text-green-600">Aprovado</span>}
                {req.status === "REJECTED" && <span className="text-red-600">Rejeitado</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
