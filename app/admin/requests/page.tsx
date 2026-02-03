"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import Breadcrumb from "@/components/Breadcrumb";

type RequestRecord = {
  id: string;
  userName: string;
  userEmail: string;
  companyName: string;
  type: "EMAIL_CHANGE" | "COMPANY_CHANGE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  payload: Record<string, unknown>;
  createdAt: string;
  reviewNote?: string;
};

function payloadString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

export default function AdminRequestsPage() {
  const router = useRouter();
  const [items, setItems] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

  const handleUnauthorized = useCallback(() => {
    const msg = "SessÃ£o expirada. FaÃ§a login novamente.";
    setMessage(msg);
    toast.error(msg);
    router.push("/login");
  }, [router]);

  const filtered = useMemo(() => {
    return items.filter(
      (req) =>
        (!status || req.status === status) &&
        (!type || req.type === type)
    );
  }, [items, status, type]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/requests", {
        credentials: "include",
        cache: "no-store",
      });

      if (res.status === 401) {
        setItems([]);
        handleUnauthorized();
        return;
      }

      if (res.status === 403) {
        setMessage("Sem permissÃ£o (faÃ§a login como admin)");
        setItems([]);
        return;
      }
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      setMessage("Erro ao carregar solicitaÃ§Ãµes");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  async function update(id: string, next: "APPROVED" | "REJECTED") {
    setMessage(null);
    const res = await fetch(`/api/admin/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
      credentials: "include",
      cache: "no-store",
    });

    if (res.status === 401) {
      handleUnauthorized();
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.message || "Erro ao atualizar";
      setMessage(msg);
      toast.error(msg);
      return;
    }
    const payload = (await res.json().catch(() => null)) as { item?: RequestRecord } | null;
    if (payload?.item) {
      setItems((prev) =>
        prev.map((req) => (req.id === payload.item?.id ? { ...req, ...payload.item } : req)),
      );
    }
    toast.success(next === "APPROVED" ? "SolicitaÃ§Ã£o aprovada" : "SolicitaÃ§Ã£o rejeitada");
    await load();
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-10 space-y-4">
        <Breadcrumb items={[{ label: "Admin", href: "/admin/home" }, { label: "SolicitaÃ§Ãµes" }]} />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-(--tc-text-primary,#0b1a3c)">SolicitaÃ§Ãµes</h1>
            <p className="text-sm sm:text-base text-(--tc-text-muted,#6b7280)">Aprovar ou rejeitar pedidos de alteraÃ§Ã£o</p>
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-2 text-sm text-(--tc-text-primary,#0b1a3c) hover:bg-(--tc-surface-2,#f3f4f6) focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30 disabled:opacity-60"
            disabled={loading}
          >
            Atualizar
          </button>
        </div>

        <div className="flex gap-3 flex-wrap" role="group" aria-label="Filtros">
          <label className="sr-only" htmlFor="requests-filter-status">
            Filtrar solicitaÃ§Ãµes por status
          </label>
          <select
            id="requests-filter-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) text-(--tc-text-primary,#0b1a3c) rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
          >
            <option value="">Status (todos)</option>
            <option value="PENDING">Pendente</option>
            <option value="APPROVED">Aprovado</option>
            <option value="REJECTED">Rejeitado</option>
          </select>

          <label className="sr-only" htmlFor="requests-filter-type">
            Filtrar solicitaÃ§Ãµes por tipo
          </label>
          <select
            id="requests-filter-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) text-(--tc-text-primary,#0b1a3c) rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30"
          >
            <option value="">Tipo (todos)</option>
            <option value="EMAIL_CHANGE">Email</option>
            <option value="COMPANY_CHANGE">Empresa</option>
          </select>
        </div>

        {message && (
          <p className="text-sm text-red-600" role="status" aria-live="polite">
            {message}
          </p>
        )}
        {loading && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando...</p>}

        <ul className="space-y-2" role="list" aria-busy={loading}>
          {filtered.length === 0 && !loading && <li className="text-sm text-(--tc-text-muted,#6b7280)">Nenhuma solicitaÃ§Ã£o.</li>}
          {filtered.map((req) => (
            <li key={req.id} className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) p-3 flex flex-col gap-2">
              <div className="flex flex-wrap justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate" title={`${req.userName} (${req.userEmail})`}>
                    {req.userName} ({req.userEmail})
                  </p>
                  <p className="text-sm text-(--tc-text-muted,#6b7280) truncate" title={req.companyName}>
                    {req.companyName}
                  </p>
                </div>
                <div className="text-sm font-bold">
                  {req.status === "PENDING" && <span className="text-yellow-600">Pendente</span>}
                  {req.status === "APPROVED" && <span className="text-green-600">Aprovado</span>}
                  {req.status === "REJECTED" && <span className="text-red-600">Rejeitado</span>}
                </div>
              </div>
              <div className="text-sm text-(--tc-text-secondary,#4b5563)">
                {req.type === "EMAIL_CHANGE" && <div>Solicitou email: {payloadString(req.payload, "newEmail")}</div>}
                {req.type === "COMPANY_CHANGE" && <div>Solicitou empresa: {payloadString(req.payload, "newCompanyName")}</div>}
                <div>Criado em {new Date(req.createdAt).toLocaleString()}</div>
                {req.reviewNote && <div>Nota: {req.reviewNote}</div>}
              </div>
              {req.status === "PENDING" && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => update(req.id, "APPROVED")}
                    className="rounded-lg bg-green-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => update(req.id, "REJECTED")}
                    className="rounded-lg bg-red-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  >
                    Rejeitar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}




