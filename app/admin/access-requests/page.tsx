"use client";

import { useEffect, useMemo, useState } from "react";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";
import { getAccessToken } from "@/lib/api";
import { extractMessageFromJson, extractRequestIdFromJson, formatMessageWithRequestId, unwrapEnvelopeData } from "@/lib/apiEnvelope";

type ClientOption = { id: string; name: string };

type RawSupportRequest = {
  id: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
  admin_notes?: string | null;
};

type AccessTypeLabel = "Usuário da empresa" | "Admin da empresa" | "Admin do sistema";

type AccessRequestItem = {
  id: string;
  createdAt: string;
  status: string;
  email: string;
  name: string;
  jobRole: string;
  accessType: AccessTypeLabel;
  clientId: string | null;
  company: string;
  notes: string;
  rawMessage: string;
  adminNotes: string | null;
};

function parseAccessType(accessType: unknown): AccessTypeLabel {
  if (accessType === "admin") return "Admin do sistema";
  if (accessType === "company") return "Admin da empresa";
  return "Usuário da empresa";
}

function parseFromMessage(message: string, fallbackEmail: string): Partial<AccessRequestItem> {
  const prefix = "ACCESS_REQUEST_V1 ";
  const line = message.split("\n").find((l) => l.startsWith(prefix));
  if (line) {
    try {
      const json = JSON.parse(line.slice(prefix.length)) as Record<string, unknown>;
      return {
        email: typeof json.email === "string" ? json.email : fallbackEmail,
        name: typeof json.name === "string" ? json.name : "",
        jobRole: typeof json.jobRole === "string" ? json.jobRole : "",
        company: typeof json.company === "string" ? json.company : "",
        clientId: typeof json.clientId === "string" ? json.clientId : null,
        accessType: parseAccessType(json.accessType),
        notes: typeof json.notes === "string" ? json.notes : "",
      };
    } catch {
      // fallthrough
    }
  }

  // Legacy fallback
  const lines = message.split("\n").map((l) => l.trim());
  const find = (label: string) => {
    const hit = lines.find((l) => l.toLowerCase().startsWith(label.toLowerCase() + ":"));
    return hit ? hit.slice(label.length + 1).trim() : "";
  };

  return {
    email: fallbackEmail,
    name: find("Nome"),
    jobRole: find("Cargo"),
    company: find("Empresa"),
    accessType: "Usuário da empresa",
    notes: find("Observacoes") || find("Mensagem"),
    clientId: null,
  };
}

async function fetchWithToken(url: string, init?: RequestInit) {
  const token = await getAccessToken().catch(() => null);
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  if (token && !headers.has("authorization")) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers, credentials: "include", cache: "no-store" });
}

function computeDirty(a: AccessRequestItem, b: Partial<AccessRequestItem>) {
  const fields: Array<keyof AccessRequestItem> = [
    "accessType",
    "clientId",
    "company",
    "jobRole",
    "name",
    "email",
    "notes",
    "adminNotes",
  ];
  return fields.some((f) => b[f] !== a[f]);
}

function toAcceptAccessType(label: AccessTypeLabel): "admin" | "company" | "user" {
  if (label === "Admin do sistema") return "admin";
  if (label === "Admin da empresa") return "company";
  return "user";
}

function AccessRequestsPage() {
  const [items, setItems] = useState<AccessRequestItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<AccessRequestItem> | null>(null);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const selected = useMemo(
    () => (selectedId ? items.find((i) => i.id === selectedId) ?? null : null),
    [items, selectedId],
  );

  const dirty = useMemo(() => {
    if (!selected || !draft) return false;
    return computeDirty(selected, draft);
  }, [selected, draft]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [reqRes, clientsRes] = await Promise.all([
        fetchWithToken("/api/admin/access-requests"),
        fetchWithToken("/api/clients"),
      ]);

      const reqRaw = await reqRes.json().catch(() => null);
      if (!reqRes.ok) {
        const msg = extractMessageFromJson(reqRaw) || "Falha ao carregar solicitações";
        const requestId = extractRequestIdFromJson(reqRaw) || reqRes.headers.get("x-request-id") || null;
        setError(formatMessageWithRequestId(msg, requestId));
        setItems([]);
        return;
      }

      const reqData = unwrapEnvelopeData<Record<string, unknown>>(reqRaw) ?? (reqRaw as Record<string, unknown> | null) ?? {};
      const rawItems = Array.isArray((reqData as any).items) ? ((reqData as any).items as RawSupportRequest[]) : [];

      const parsed: AccessRequestItem[] = rawItems.map((r) => {
        const parsedMsg = parseFromMessage(String(r.message ?? ""), String(r.email ?? ""));
        return {
          id: String(r.id),
          createdAt: String(r.created_at),
          status: String(r.status ?? "open"),
          email: String(parsedMsg.email ?? r.email ?? ""),
          name: String(parsedMsg.name ?? ""),
          jobRole: String(parsedMsg.jobRole ?? ""),
          accessType: (parsedMsg.accessType as AccessTypeLabel) ?? "Usuário da empresa",
          clientId: (parsedMsg.clientId as string | null) ?? null,
          company: String(parsedMsg.company ?? ""),
          notes: String(parsedMsg.notes ?? ""),
          rawMessage: String(r.message ?? ""),
          adminNotes: (r.admin_notes as string | null) ?? null,
        };
      });


      const cRaw = await clientsRes.json().catch(() => null);
      if (!clientsRes.ok) {
        const msg = extractMessageFromJson(cRaw) || "Falha ao carregar empresas";
        const requestId = extractRequestIdFromJson(cRaw) || clientsRes.headers.get("x-request-id") || null;
        setError(formatMessageWithRequestId(msg, requestId));
        setClients([]);
      }

      const cData = unwrapEnvelopeData<Record<string, unknown>>(cRaw) ?? (cRaw as Record<string, unknown> | null) ?? {};
      const cItems = Array.isArray((cData as any).items) ? ((cData as any).items as unknown[]) : [];
      const mappedClients = cItems
        .map((c) => {
          const rec = (c ?? null) as Record<string, unknown> | null;
          return {
            id: typeof rec?.id === "string" ? rec.id : "",
            name:
              (typeof rec?.name === "string" ? rec.name : "") ||
              (typeof rec?.company_name === "string" ? String(rec.company_name) : ""),
          };
        })
        .filter((c) => c.id && c.name);

      setClients(mappedClients);
      setItems(parsed);
      setSelectedId((prev) => (prev && parsed.some((p) => p.id === prev) ? prev : parsed[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft({ ...selected });
  }, [selectedId]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  async function saveChanges() {
    if (!selected || !draft) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithToken(`/api/admin/access-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: draft.email,
          name: draft.name,
          role: draft.jobRole,
          company: draft.company,
          client_id: draft.clientId,
          access_type: draft.accessType,
          notes: draft.notes,
          admin_notes: draft.adminNotes,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((json.error as string) || (json.message as string) || "Falha ao salvar");
        return;
      }

      await load();
    } finally {
      setSaving(false);
    }
  }

  async function acceptRequest() {
    if (!selected || !draft) return;

    setAccepting(true);
    setError(null);
    try {
      const res = await fetchWithToken(`/api/admin/access-requests/${selected.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: draft.email,
          name: draft.name,
          client_id: draft.clientId,
          access_type: toAcceptAccessType((draft.accessType ?? "Usuário da empresa") as AccessTypeLabel),
        }),
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((json.error as string) || (json.message as string) || "Falha ao aceitar");
        return;
      }

      await load();
    } finally {
      setAccepting(false);
    }
  }

  async function rejectRequest() {
    if (!selected || !draft) return;

    setAccepting(true);
    setError(null);
    try {
      const res = await fetchWithToken(`/api/admin/access-requests/${selected.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: draft.adminNotes ?? "",
        }),
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((json.error as string) || (json.message as string) || "Falha ao recusar");
        return;
      }

      await load();
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Solicitacoes de acesso</h1>
          <p className="text-sm text-gray-600">Lista de solicitacoes com aprovacao pelo admin.</p>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border bg-white">
          <div className="border-b px-4 py-3 text-sm font-semibold">Solicitacoes</div>
          {loading ? (
            <div className="px-4 py-3 text-sm text-gray-600">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-600">Nenhuma solicitacao.</div>
          ) : (
            <div className="divide-y">
              {items.map((it) => (
                <button
                  key={it.id}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${selectedId === it.id ? "bg-gray-50" : ""}`}
                  onClick={() => setSelectedId(it.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{it.name || "(sem nome)"}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span className="truncate">{it.email}</span>
                        <span className="text-gray-300">•</span>
                        <span>{new Date(it.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs hover:bg-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          copy(it.email);
                        }}
                        title="Copiar email"
                        aria-label="Copiar email"
                      >
                        Copiar
                      </button>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          it.status === "closed"
                            ? "bg-green-100 text-green-700"
                            : it.status === "in_progress"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {it.status}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white">
          <div className="border-b px-4 py-3 text-sm font-semibold">Detalhes</div>
          {!selected || !draft ? (
            <div className="px-4 py-3 text-sm text-gray-600">Selecione uma solicitacao.</div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  Tipo de acesso
                  <select
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={(draft.accessType ?? "Usuário da empresa") as AccessTypeLabel}
                    onChange={(e) => {
                      const v = e.target.value as AccessTypeLabel;
                      setDraft((d) => (d ? { ...d, accessType: v } : d));
                      if (v === "Admin do sistema") setDraft((d) => (d ? { ...d, clientId: null, company: "" } : d));
                    }}
                    aria-label="Tipo de acesso"
                    title="Tipo de acesso"
                  >
                    <option value="Usuário da empresa">Usuário da empresa</option>
                    <option value="Admin da empresa">Admin da empresa</option>
                    <option value="Admin do sistema">Admin do sistema</option>
                  </select>
                </label>

                <label className="block text-sm">
                  Empresa
                  <select
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={draft.clientId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      const match = clients.find((c) => c.id === id);
                      setDraft((d) => (d ? { ...d, clientId: id, company: match?.name ?? d.company ?? "" } : d));
                    }}
                    disabled={draft.accessType === "Admin do sistema"}
                    aria-label="Empresa"
                    title="Empresa"
                  >
                    <option value="">Selecionar empresa</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  Nome
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={draft.name ?? ""}
                    onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                  />
                </label>

                <label className="block text-sm">
                  Email
                  <input
                    type="email"
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={draft.email ?? ""}
                    onChange={(e) => setDraft((d) => (d ? { ...d, email: e.target.value } : d))}
                  />
                </label>

                <label className="block text-sm sm:col-span-2">
                  Cargo
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={draft.jobRole ?? ""}
                    onChange={(e) => setDraft((d) => (d ? { ...d, jobRole: e.target.value } : d))}
                  />
                </label>

                <label className="block text-sm sm:col-span-2">
                  Observacoes
                  <textarea
                    className="mt-1 w-full rounded border px-3 py-2"
                    rows={4}
                    value={draft.notes ?? ""}
                    onChange={(e) => setDraft((d) => (d ? { ...d, notes: e.target.value } : d))}
                  />
                </label>

                <label className="block text-sm sm:col-span-2">
                  Notas do admin (motivo / observação)
                  <textarea
                    className="mt-1 w-full rounded border px-3 py-2"
                    rows={3}
                    value={draft.adminNotes ?? ""}
                    onChange={(e) => setDraft((d) => (d ? { ...d, adminNotes: e.target.value } : d))}
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveChanges}
                  disabled={!dirty || saving}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar alteracoes"}
                </button>
                <button
                  type="button"
                  onClick={acceptRequest}
                  disabled={
                    accepting ||
                    ((draft.accessType ?? "Usuário da empresa") !== "Admin do sistema" && !draft.clientId)
                  }
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-60"
                >
                  {accepting ? "Aceitando..." : "Aceitar solicitacao"}
                </button>

                <button
                  type="button"
                  onClick={rejectRequest}
                  disabled={accepting}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-60"
                >
                  {accepting ? "Processando..." : "Recusar solicitacao"}
                </button>
              </div>

              <details className="rounded border bg-gray-50 p-3">
                <summary className="cursor-pointer text-sm text-gray-700">Ver mensagem bruta</summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700">{selected.rawMessage}</pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AccessRequestsPageWithGuard() {
  return (
    <RequireGlobalAdmin>
      <AccessRequestsPage />
    </RequireGlobalAdmin>
  );
}
