"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";
import { CreateUserModal } from "./components/CreateUserModal";
import { getAccessToken } from "@/lib/api";

type ClientOption = { id: string; name: string };
type UserItem = { id: string; name: string; email?: string; role?: string; job_title?: string | null; client_id?: string | null; active?: boolean; linkedin_url?: string };

function AdminUsersPage() {
  const { user } = useAuthUser();
  const isGlobalAdmin = !!user?.isGlobalAdmin || (user as any)?.is_global_admin === true;

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!selectedClientId) return users;
    return users.filter((u) => u.client_id === selectedClientId);
  }, [users, selectedClientId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const token = await getAccessToken().catch(() => null);
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const resClients = await fetch("/api/clients", { cache: "no-store", credentials: "include", headers });
        const clientsJson = await resClients.json().catch(() => ({}));
        const clientItems = Array.isArray(clientsJson.items) ? clientsJson.items : [];
        const mappedClients: ClientOption[] = clientItems.map((c: any) => ({ id: c.id, name: c.name ?? c.company_name ?? "" }));
        setClients(mappedClients);
        setSelectedClientId(mappedClients[0]?.id ?? null);

        const resUsers = await fetch("/api/admin/users", { credentials: "include" });
        const usersJson = await resUsers.json().catch(() => ({ items: [] }));
        setUsers(Array.isArray(usersJson.items) ? usersJson.items : []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao carregar dados";
        setMessage(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#0b1a3c] px-6 py-10 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Usuários</h1>
          <p className="text-sm text-gray-600">Gerencie usuários e vínculos com empresas.</p>
        </div>
        {isGlobalAdmin && (
          <button
            onClick={() => setOpenModal(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            + Criar usuário
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-700">
          Empresa:
          <select
            className="ml-2 rounded border border-gray-200 px-3 py-2 text-sm"
            value={selectedClientId ?? ""}
            onChange={(e) => setSelectedClientId(e.target.value || null)}
          >
            <option value="">Todas</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {message && <p className="text-sm text-red-600">{message}</p>}
      {loading && <p className="text-sm text-gray-600">Carregando...</p>}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="divide-y divide-gray-200">
          {filteredUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-semibold text-sm text-gray-900">{u.name}</div>
                <div className="text-xs text-gray-500">{u.email}</div>
                <div className="text-xs text-gray-500">{u.role ?? "client_member"}</div>
              </div>
              <button
                className="text-xs text-indigo-700 hover:underline"
                onClick={() => {
                  setSelectedClientId(u.client_id ?? null);
                  setOpenModal(true);
                }}
              >
                Editar
              </button>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-600">Nenhum usuário encontrado.</div>
          )}
        </div>
      </div>

      <CreateUserModal
        open={openModal}
        clientId={selectedClientId}
        clients={clients}
        users={users.filter((u) => !selectedClientId || u.client_id === selectedClientId)}
        onClose={() => setOpenModal(false)}
        onCreated={async () => {
          const resUsers = await fetch("/api/admin/users", { credentials: "include" });
          const usersJson = await resUsers.json().catch(() => ({ items: [] }));
          setUsers(Array.isArray(usersJson.items) ? usersJson.items : []);
        }}
      />
    </div>
  );
}

export default function AdminUsersPageWithGuard() {
  return (
    <RequireGlobalAdmin>
      <AdminUsersPage />
    </RequireGlobalAdmin>
  );
}
