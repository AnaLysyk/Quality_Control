"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import Breadcrumb from "@/components/Breadcrumb";

type RequestRecord = {
  id: string;
  type: "EMAIL_CHANGE" | "COMPANY_CHANGE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  payload: Record<string, unknown>;
  createdAt: string;
  reviewNote?: string;
};

export default function RequestsPage() {
  const router = useRouter();
  const [items, setItems] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function handleUnauthorized() {
    const msg = "Sessão expirada. Faça login novamente.";
    setMessage(msg);
    toast.error(msg);
    router.push("/login");
  }

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await fetch("/api/requests/me", {
        credentials: "include",
        cache: "no-store",
      });

      if (res.status === 401) {
        setItems([]);
        handleUnauthorized();
        return;
      }

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
      credentials: "include",
      cache: "no-store",
    });

    if (res.status === 401) {
      handleUnauthorized();
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.message || "Erro ao enviar solicitação";
      setMessage(msg);
      toast.error(msg);
      return;
    }
    setEmail("");
    setMessage("Solicitação de email enviada");
    toast.success("Solicitação de email enviada");
    loadRequests();
  }

  async function submitCompany() {
    setMessage(null);
    const res = await fetch("/api/requests/company-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newCompanyName: company }),
      credentials: "include",
      cache: "no-store",
    });

    if (res.status === 401) {
      handleUnauthorized();
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.message || "Erro ao enviar solicitação";
      setMessage(msg);
      toast.error(msg);
      return;
    }
    setCompany("");
    setMessage("Solicitação de empresa enviada");
    toast.success("Solicitação de empresa enviada");
    loadRequests();
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-10 space-y-6">
        <Breadcrumb items={[{ label: "Conta", href: "/settings" }, { label: "Solicitações" }]} />

        <h1 className="text-2xl sm:text-3xl font-extrabold text-(--tc-text-primary,#0b1a3c)">Minhas solicitações</h1>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 space-y-3">
            <h2 className="text-lg font-semibold text-(--tc-text-primary,#0b1a3c)">Solicitar alteração de email</h2>
            <label className="block text-sm text-(--tc-text-muted,#6b7280)" htmlFor="request-email">
              Novo email
            </label>
            <input
              id="request-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="novo@email.com"
              className="w-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) text-(--tc-text-primary,#0b1a3c) rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
            />
            <button
              type="button"
              onClick={submitEmail}
              className="rounded-lg bg-(--tc-surface-dark,#0b1a3c) text-(--tc-text-inverse,#ffffff) px-4 py-2 focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30 disabled:opacity-60"
              disabled={!email}
            >
              Enviar
            </button>
          </section>

          <section className="rounded-xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 space-y-3">
            <h2 className="text-lg font-semibold text-(--tc-text-primary,#0b1a3c)">Solicitar alteração de empresa</h2>
            <label className="block text-sm text-(--tc-text-muted,#6b7280)" htmlFor="request-company">
              Novo nome da empresa
            </label>
            <input
              id="request-company"
              type="text"
              autoComplete="organization"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Novo nome da empresa"
              className="w-full border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) text-(--tc-text-primary,#0b1a3c) rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
            />
            <button
              type="button"
              onClick={submitCompany}
              className="rounded-lg bg-(--tc-surface-dark,#0b1a3c) text-(--tc-text-inverse,#ffffff) px-4 py-2 focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30 disabled:opacity-60"
              disabled={!company}
            >
              Enviar
            </button>
          </section>
        </div>

        {message && (
          <p className="text-sm text-(--tc-text-primary,#0b1a3c)" role="status" aria-live="polite">
            {message}
          </p>
        )}

        <section className="rounded-xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-4 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-(--tc-text-primary,#0b1a3c)">Status</h2>
            {loading && <span className="text-sm text-(--tc-text-muted,#6b7280)">Carregando...</span>}
          </div>
          {items.length === 0 && <p className="text-sm text-(--tc-text-muted,#6b7280)">Nenhuma solicitação.</p>}
          <ul className="space-y-2" role="list" aria-busy={loading}>
            {items.map((req) => (
              <li
                key={req.id}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-2"
              >
                <div>
                  <p className="font-semibold text-(--tc-text-primary,#0b1a3c)">
                    {req.type === "EMAIL_CHANGE" ? "Troca de email" : "Troca de empresa"}
                  </p>
                  <p className="text-sm text-(--tc-text-muted,#6b7280)">Criado em {new Date(req.createdAt).toLocaleString()}</p>
                  {req.reviewNote && <p className="text-sm text-(--tc-text-muted,#6b7280)">Nota: {req.reviewNote}</p>}
                </div>
                <div className="text-sm font-bold">
                  {req.status === "PENDING" && <span className="text-yellow-600">Pendente</span>}
                  {req.status === "APPROVED" && <span className="text-green-600">Aprovado</span>}
                  {req.status === "REJECTED" && <span className="text-red-600">Rejeitado</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
