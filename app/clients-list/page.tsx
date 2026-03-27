"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuthUser } from "@/hooks/useAuthUser";
import { CreateClientModal, type ClientFormValues } from "@/clients/components/CreateClientModal";
import { RequireAuth } from "@/components/RequireAuth";

type Client = {
  id: string;
  name: string;
  slug?: string | null;
  taxId?: string | null;
  zip?: string | null;
  address?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  linkedin?: string | null;
  active: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function mapClient(row: unknown): Client {
  const rec = asRecord(row) ?? {};
  return {
    id: typeof rec.id === "string" ? rec.id : "",
    name:
      (typeof rec.name === "string" ? rec.name : null) ??
      (typeof rec.company_name === "string" ? rec.company_name : null) ??
      "",
    slug: typeof rec.slug === "string" ? rec.slug : null,
    taxId: typeof rec.tax_id === "string" ? rec.tax_id : null,
    address: typeof rec.address === "string" ? rec.address : null,
    linkedin: typeof rec.docs_link === "string" ? rec.docs_link : null,
    description: typeof rec.description === "string" ? rec.description : null,
    logoUrl: typeof rec.logo_url === "string" ? rec.logo_url : null,
    active: rec.active === true,
  };
}

function ClientesPage() {
  const { user } = useAuthUser();
  const legacyIsGlobalAdmin = asRecord(user)?.is_global_admin === true;
  const isGlobalAdmin = !!user?.isGlobalAdmin || legacyIsGlobalAdmin;

  const [items, setItems] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((c) => c.name.toLowerCase().includes(term));
  }, [items, search]);

  async function load() {
    setLoading(true);
    setMessage(null);
    try {
      const { getAccessToken } = await import("@/lib/api");
      const token = await getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch("/api/clients", { cache: "no-store", headers, credentials: "include" });
      if (res.status === 403) {
        setMessage("Apenas administradores podem listar clientes.");
        setItems([]);
        return;
      }
      const json = await res.json().catch(() => ({}));
      const data = Array.isArray(json.items)
        ? (json.items as unknown[])
        : Array.isArray(json)
          ? (json as unknown[])
          : [];
      setItems(data.map(mapClient).filter((c) => c.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar clientes";
      setMessage(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateClient(data: ClientFormValues) {
    try {
      const payload = {
        name: data.name,
        company_name: data.name,
        tax_id: data.taxId,
        address: [data.zip, data.address ?? data.description].filter(Boolean).join(" | "),
        description: data.description,
        logo_url: data.logoUrl,
        docs_link: data.docsLink,
        linkedin_url: data.linkedin,
        notes: data.notes,
        phone: data.phone,
        website: data.website,
        active: data.active,
      };
      const { getAccessToken } = await import("@/lib/api");
      const token = await getAccessToken();
      const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const res = await fetch("/api/clients", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(err.error || err.message || "Erro ao criar cliente");
        return null;
      }
      const created = await res.json().catch(() => null);
      if (created) {
        setItems((prev) => [mapClient(created), ...prev]);
        return created;
      }
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar cliente";
      setMessage(msg);
      return null;
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#0b1a3c] px-6 py-10 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-sm text-gray-600">Crie e gerencie empresas (clientes). Perfil nao e criado aqui.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isGlobalAdmin && (
            <button
              onClick={() => setOpenCreate(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              + Cadastrar empresa
            </button>
          )}
          <button onClick={load} className="rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm" disabled={loading}>
            Atualizar
          </button>
        </div>
      </div>

      <input
        type="search"
        className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
        placeholder="Buscar cliente pelo nome"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {message && <p className="text-sm text-red-600">{message}</p>}
      {loading && <p className="text-sm text-gray-600">Carregando...</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((client) => {
          const profileHref = `/empresas/${client.slug ?? client.id}/home`;
          return (
            <div key={client.id} className="w-full rounded-lg border border-[#e5e7eb] p-4 bg-white shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded bg-gray-100 overflow-hidden flex items-center justify-center">
                  {client.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={client.logoUrl} alt={client.name} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs text-gray-500">Sem logo</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{client.name}</div>
                  {client.taxId && <div className="text-xs text-gray-500">{client.taxId}</div>}
                  {client.address && <div className="text-xs text-gray-500">{client.address}</div>}
                </div>
              </div>
              <div className="mt-3">
                <Link
                  href={profileHref}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#0b1a3c] hover:text-[#e53935]"
                >
                  Acessar perfil
                </Link>
              </div>
            </div>
          );
        })}

        {!filtered.length && !loading && (
          <div className="text-sm text-gray-600">
            {isGlobalAdmin ? (
              <div className="mt-2 rounded-xl border border-dashed border-gray-300 p-4 text-center">
                <p className="text-sm text-gray-700">Voce ainda nao criou nenhuma empresa.</p>
                <button
                  onClick={() => setOpenCreate(true)}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white shadow-sm hover:bg-indigo-500"
                >
                  + Criar empresa
                </button>
              </div>
            ) : (
              <p>Nenhum cliente encontrado.</p>
            )}
          </div>
        )}
      </div>

      <CreateClientModal open={openCreate} onClose={() => setOpenCreate(false)} onCreate={handleCreateClient} />
    </div>
  );
}

export default function ClientesPageWithGuard() {
  return (
    <RequireAuth>
      <ClientesPage />
    </RequireAuth>
  );
}
