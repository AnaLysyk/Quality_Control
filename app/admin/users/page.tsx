"use client";

import React, { useEffect, useState } from 'react';
import UserDrawer from './UserDrawer';

function CreateUserForm({ onCreated }: { onCreated: ()=>void }){
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');

  async function submit(){
    await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, role, client_id: 'c_testing' }) });
    setOpen(false); setName(''); setEmail(''); setRole('user');
    onCreated();
  }

  return (
    <div>
      <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={()=>setOpen(true)}>Criar usuário</button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-4 rounded w-96">
            <h3 className="font-semibold mb-2">Criar usuário</h3>
            <input className="w-full border p-2 mb-2" placeholder="Nome" value={name} onChange={(e)=>setName(e.target.value)} />
            <input className="w-full border p-2 mb-2" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
            <select aria-label="Role" title="Role" className="w-full border p-2 mb-2" value={role} onChange={(e)=>setRole(e.target.value)}>
              <option value="user">User</option>
              <option value="company">Company</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button className="px-3 py-1" onClick={()=>setOpen(false)}>Cancelar</button>
              <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={submit}>Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type User = {
  id: string;
  name: string;
  email?: string;
  role?: string;
  companyIds?: string[];
  active?: boolean;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<User | null>(null);

  async function load() {
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
    const json = await res.json();
    setUsers(json.items || []);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Gestão de Usuários</h1>
        <div className="flex gap-2 items-center">
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Buscar por nome ou email" className="border rounded px-2 py-1" />
          <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={load}>Buscar</button>
          <CreateUserForm onCreated={load} />
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left border-b"><th className="p-2">Nome</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-b">
              <td className="p-2">{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.active ? 'Ativo' : 'Inativo'}</td>
              <td className="p-2"><button className="text-blue-600" onClick={()=>setSelected(u)}>Ver</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && <UserDrawer user={selected} onClose={()=>{ setSelected(null); load(); }} />}
    </div>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";
import { CreateUserModal } from "./components/CreateUserModal";
import { UserDetailsModal } from "./components/UserDetailsModal";
import { getAccessToken } from "@/lib/api";
import { toast } from "react-hot-toast";
import { extractMessageFromJson, extractRequestIdFromJson, formatMessageWithRequestId, unwrapEnvelopeData } from "@/lib/apiEnvelope";

type ClientOption = { id: string; name: string };
type UserItem = { id: string; name: string; email?: string; user?: string; role?: string; job_title?: string | null; client_id?: string | null; active?: boolean; linkedin_url?: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function getItemsFromEnvelope<T>(value: unknown): T[] {
  if (!value || typeof value !== "object") return [];
  const items = (value as { items?: unknown }).items;
  return Array.isArray(items) ? (items as T[]) : [];
}

function AdminUsersPage() {
  const router = useRouter();
  const { user } = useAuthUser();
  const legacyIsGlobalAdmin = asRecord(user)?.is_global_admin === true;
  const isGlobalAdmin = !!user?.isGlobalAdmin || legacyIsGlobalAdmin;

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsUserId, setDetailsUserId] = useState<string | null>(null);
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedUser = useMemo(() => {
    if (!detailsUserId) return null;
    return users.find((u) => u.id === detailsUserId) ?? null;
  }, [users, detailsUserId]);

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
        if (resClients.status === 401) {
          toast.error("Sessão expirada. Faça login novamente.");
          router.replace("/login");
          return;
        }
        const clientsRaw = await resClients.json().catch(() => null);
        if (!resClients.ok) {
          const msg = extractMessageFromJson(clientsRaw) || "Falha ao carregar empresas";
          const requestId = extractRequestIdFromJson(clientsRaw) || resClients.headers.get("x-request-id") || null;
          throw new Error(formatMessageWithRequestId(msg, requestId));
        }

        const clientsData = unwrapEnvelopeData<Record<string, unknown>>(clientsRaw) ?? (clientsRaw as Record<string, unknown> | null) ?? {};
        const clientItems = getItemsFromEnvelope<unknown>(clientsData);
        const mappedClients: ClientOption[] = clientItems
          .map((c) => {
            const rec = asRecord(c) ?? {};
            const id = typeof rec.id === "string" ? rec.id : "";
            const name =
              (typeof rec.name === "string" ? rec.name : null) ??
              (typeof rec.company_name === "string" ? rec.company_name : null) ??
              "";
            return { id, name };
          })
          .filter((c) => c.id);
        setClients(mappedClients);
        setSelectedClientId(mappedClients[0]?.id ?? null);

        const resUsers = await fetch("/api/admin/users", { credentials: "include" });
        if (resUsers.status === 401) {
          toast.error("Sessão expirada. Faça login novamente.");
          router.replace("/login");
          return;
        }
        const usersRaw = await resUsers.json().catch(() => null);
        if (!resUsers.ok) {
          const msg = extractMessageFromJson(usersRaw) || "Falha ao carregar usuarios";
          const requestId = extractRequestIdFromJson(usersRaw) || resUsers.headers.get("x-request-id") || null;
          throw new Error(formatMessageWithRequestId(msg, requestId));
        }
        const usersData = unwrapEnvelopeData<Record<string, unknown>>(usersRaw) ?? (usersRaw as Record<string, unknown> | null) ?? {};
        setUsers(getItemsFromEnvelope<UserItem>(usersData));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao carregar dados";
        setMessage(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  return (
    <div className="min-h-screen bg-white text-[#0b1a3c] px-6 py-10 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Usuários</h1>
          <p className="text-sm text-gray-600">Gerencie usuários e vínculos com empresas.</p>
        </div>
        {isGlobalAdmin && (
          <button
            onClick={() => {
              setCreateOpen(true);
            }}
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
            <button
              key={u.id}
              type="button"
              className="w-full text-left flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              onClick={() => {
                if (detailsOpen && detailsDirty && detailsUserId && detailsUserId !== u.id) {
                  const ok = window.confirm("Voce tem alteracoes nao salvas. Deseja descartar e abrir outro usuario?");
                  if (!ok) return;
                }
                setDetailsUserId(u.id);
                setDetailsOpen(true);
              }}
            >
              <div>
                <div className="font-semibold text-sm text-gray-900">{u.name}</div>
                <div className="text-xs text-gray-500">{u.user ?? u.email}</div>
                <div className="text-xs text-gray-500">{u.email}</div>
                <div className="text-xs text-gray-500">{u.role ?? "client_user"}</div>
              </div>
              <span className="text-xs text-indigo-700">Detalhes</span>
            </button>
          ))}
          {filteredUsers.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-600">Nenhum usuário encontrado.</div>
          )}
        </div>
      </div>

      <CreateUserModal
        open={createOpen}
        clientId={selectedClientId}
        clients={clients}
        onClose={() => {
          setCreateOpen(false);
        }}
        onCreated={async () => {
          const resUsers = await fetch("/api/admin/users", { credentials: "include" });
          if (resUsers.status === 401) {
            toast.error("Sessão expirada. Faça login novamente.");
            router.replace("/login");
            return;
          }
          const usersRaw = await resUsers.json().catch(() => null);
          if (!resUsers.ok) {
            const msg = extractMessageFromJson(usersRaw) || "Falha ao carregar usuarios";
            const requestId = extractRequestIdFromJson(usersRaw) || resUsers.headers.get("x-request-id") || null;
            toast.error(formatMessageWithRequestId(msg, requestId));
            setUsers([]);
            return;
          }
          const usersData = unwrapEnvelopeData<Record<string, unknown>>(usersRaw) ?? (usersRaw as Record<string, unknown> | null) ?? {};
          setUsers(getItemsFromEnvelope<UserItem>(usersData));
        }}
      />

      <UserDetailsModal
        open={detailsOpen}
        user={selectedUser}
        clients={clients}
        onDirtyChange={(dirty) => setDetailsDirty(dirty)}
        onClose={() => {
          if (detailsDirty) {
            const ok = window.confirm("Voce tem alteracoes nao salvas. Deseja descartar?");
            if (!ok) return;
          }
          setDetailsOpen(false);
          setDetailsUserId(null);
          setDetailsDirty(false);
        }}
        onSaved={async () => {
          const resUsers = await fetch("/api/admin/users", { credentials: "include" });
          if (resUsers.status === 401) {
            toast.error("Sessão expirada. Faça login novamente.");
            router.replace("/login");
            return;
          }
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
