"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientSearchBar } from "./components/ClientSearchBar";
import { ClientList } from "./components/ClientList";
import { ClientDetails } from "./components/ClientDetails";
import { CreateUserModal } from "@/admin/users/components/CreateUserModal";
import { CreateClientModal, type ClientFormValues } from "./components/CreateClientModal";
import { useAuthUser } from "@/hooks/useAuthUser";
import { getAccessToken } from "@/lib/api";
import { RequireAuth } from "@/components/RequireAuth";

type TeamMember = {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
};

type Client = {
  id: string;
  name: string;
  slug?: string | null;
  taxId?: string | null;
  zip?: string | null;
  address?: string | null;
  description?: string | null;
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  docsLink?: string | null;
  linkedin?: string | null;
  notes?: string | null;
  active: boolean;
  team: TeamMember[];
};

function readNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function mapClient(row: Record<string, unknown>): Client {
  const name =
    typeof row.name === "string"
      ? row.name
      : typeof row.company_name === "string"
        ? row.company_name
        : "";
  const id = typeof row.id === "string" ? row.id : String(row.id ?? "");

  return {
    id,
    name,
    slug: readNullableString(row.slug),
    taxId: readNullableString(row.tax_id),
    zip: readNullableString(row.cep),
    address: readNullableString(row.address) ?? readNullableString(row.address_detail),
    description: readNullableString(row.short_description) ?? readNullableString(row.description),
    website: readNullableString(row.website),
    phone: readNullableString(row.phone),
    logoUrl: readNullableString(row.logo_url),
    docsLink: readNullableString((row as { docs_link?: unknown; docs_url?: unknown }).docs_link ?? row.docs_url),
    linkedin: readNullableString(row.linkedin_url),
    notes:
      readNullableString(row.internal_notes) ??
      readNullableString(row.extra_notes) ??
      readNullableString(row.notes),
    active: readBoolean(row.active),
    team: [],
  };
}

function ClientsPage() {
  const router = useRouter();
  const { user } = useAuthUser();
  const legacyIsGlobalAdmin = (user as { is_global_admin?: boolean } | null)?.is_global_admin === true;
  const isGlobalAdmin = !!user?.isGlobalAdmin || legacyIsGlobalAdmin;

  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const visibleClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(term));
  }, [clients, search]);

  const selected = useMemo(() => clients.find((c) => c.id === selectedId) ?? null, [clients, selectedId]);

  const loadTeamForClient = useCallback(
    async (clientId: string | null) => {
      if (!clientId || !isGlobalAdmin) return;
      try {
        const token = await getAccessToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch(`/api/admin/users?client_id=${clientId}`, {
          cache: "no-store",
          headers,
          credentials: "include",
        });
        if (!res.ok) return;
        const json = await res.json().catch(() => ({}));
        const items = Array.isArray(json.items) ? (json.items as Array<Record<string, unknown>>) : [];
        const members: TeamMember[] = items.map((item) => {
          const role = typeof item.role === "string" ? item.role : "";
          return {
            id: typeof item.id === "string" ? item.id : String(item.id ?? ""),
            name: typeof item.name === "string" ? item.name : "",
            role:
              role === "global_admin"
                ? "Admin global"
                : role === "client_admin"
                  ? "Admin"
                  : role === "it_dev"
                    ? "Dev / IT"
                    : role === "leader_tc"
                      ? "Lider TC"
                      : role === "technical_support"
                        ? "Suporte Tecnico"
                        : "Usuario",
            avatarUrl: typeof item.avatar_url === "string" ? item.avatar_url : null,
          };
        });
        setClients((prev) =>
          prev.map((client) => (client.id === clientId ? { ...client, team: members } : client)),
        );
      } catch {
        // ignore team load failures
      }
    },
    [isGlobalAdmin],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = await getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch("/api/clients", { cache: "no-store", headers, credentials: "include" });
      if (res.status === 401) {
        setMessage("Sessao expirada. Faca login novamente.");
        router.replace("/login");
        setClients([]);
        return;
      }
      if (res.status === 403) {
        setMessage("Apenas administradores podem listar empresas.");
        setClients([]);
        return;
      }
      const json = await res.json().catch(() => ({}));
      const data = Array.isArray(json.items)
        ? (json.items as Record<string, unknown>[])
        : Array.isArray(json)
          ? (json as Record<string, unknown>[])
          : [];
      setClients(data.map((row) => mapClient(row)).filter((item) => item.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar empresas";
      setMessage(msg);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!clients.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !clients.some((c) => c.id === selectedId)) {
      setSelectedId(clients[0]?.id ?? null);
    }
  }, [clients, selectedId]);

  useEffect(() => {
    loadTeamForClient(selectedId);
  }, [selectedId, loadTeamForClient]);

  async function handleCreateClient(data: ClientFormValues) {
    try {
      setMessage(null);
      const token = await getAccessToken();
      const normalizedCodes =
        Array.isArray(data.qaseProjectCodes) && data.qaseProjectCodes.length ? data.qaseProjectCodes : undefined;
      const legacyProjectCode =
        data.integrationMode === "qase" ? data.qaseProjectCode || normalizedCodes?.[0] : undefined;

      const integrations: Array<{ type: string; config?: Record<string, unknown> }> = [];
      if (data.qaseToken || normalizedCodes?.length) {
        integrations.push({ type: "QASE", config: { token: data.qaseToken ?? null, projects: normalizedCodes ?? [] } });
      }
      if (data.jiraApiToken || data.jiraBaseUrl) {
        integrations.push({ type: "JIRA", config: { baseUrl: data.jiraBaseUrl ?? null, email: data.jiraEmail ?? null, apiToken: data.jiraApiToken ?? null } });
      }

      const payload = {
        name: data.name,
        company_name: data.name,
        tax_id: data.taxId,
        cep: data.zip,
        address: data.address,
        phone: data.phone,
        website: data.website,
        logo_url: data.logoUrl,
        docs_link: data.docsLink,
        linkedin_url: data.linkedin,
        description: data.description,
        short_description: data.description,
        notes: data.notes,
        internal_notes: data.notes,
        active: data.active,
        integration_mode: data.integrationMode,
        qase_token: data.integrationMode === "qase" ? data.qaseToken : undefined,
        qase_project_code: legacyProjectCode,
        qase_project_codes: data.integrationMode === "qase" ? normalizedCodes : undefined,
        jira_base_url: data.jiraBaseUrl,
        jira_email: data.jiraEmail,
        jira_api_token: data.jiraApiToken,
        integrations: integrations.length ? integrations : undefined,
      };

      const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const res = await fetch("/api/clients", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        setMessage("Sessao expirada. Faca login novamente.");
        router.replace("/login");
        return null;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error || err.message || "Erro ao criar empresa";
        setMessage(msg);
        throw new Error(msg);
      }
      const created = await res.json().catch(() => null);
      if (created) {
        const mapped = mapClient(created as Record<string, unknown>);
        setClients((prev) => [mapped, ...prev]);
        setSelectedId(mapped.id);
        return created;
      }
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar empresa";
      setMessage(msg);
      throw err instanceof Error ? err : new Error(msg);
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-[#0a1533] via-[#0f1f4b] to-[#0a1533] px-6 py-8 text-[#0b1a3c]">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-white">
          <div>
            <p className="text-xs uppercase tracking-wide text-indigo-200">Gestao</p>
            <h1 className="text-3xl font-bold">Clientes</h1>
          </div>
          {isGlobalAdmin && (
            <button
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400"
              onClick={() => setCreateClientOpen(true)}
            >
              + Cadastrar instituicao ou empresa
            </button>
          )}
        </header>

        <div className="rounded-xl bg-white/95 p-5 shadow-xl backdrop-blur">
          <ClientSearchBar value={search} onChange={setSearch} />
          {message && <p className="mt-2 text-sm text-red-600">{message}</p>}
          {loading && <p className="mt-2 text-sm text-gray-600">Carregando...</p>}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_2fr]">
            <div>
              <ClientList items={visibleClients} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <ClientDetails
                client={selected}
                isGlobalAdmin={isGlobalAdmin}
                onOpenCreateUser={() => setCreateUserOpen(true)}
                onEditClient={() => setCreateClientOpen(true)}
              />
            </div>
          </div>
        </div>
      </div>

      <CreateUserModal
        open={createUserOpen}
        clientId={selectedId}
        clients={clients.map((client) => ({ id: client.id, name: client.name }))}
        initialRole="company_user"
        onClose={() => setCreateUserOpen(false)}
        onCreated={() => loadTeamForClient(selectedId)}
      />
      <CreateClientModal
        open={createClientOpen}
        onClose={() => setCreateClientOpen(false)}
        onCreate={handleCreateClient}
        onOpenUser={(clientId) => {
          if (clientId) setSelectedId(clientId);
          setCreateUserOpen(true);
        }}
      />
    </div>
  );
}

export default function ClientsPageWithGuard() {
  return (
    <RequireAuth>
      <ClientsPage />
    </RequireAuth>
  );
}
