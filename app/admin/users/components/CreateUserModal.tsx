"use client";

import { useEffect, useMemo, useState } from "react";

type ClientOption = { id: string; name: string };

type Props = {
  open: boolean;
  clientId: string | null;
  clients?: ClientOption[];
  onClose: () => void;
  onCreated?: () => void;
  users?: Array<{ id: string; name: string; job_title?: string | null; role?: string | null; client_id?: string | null; email?: string; linkedin_url?: string; active?: boolean }>;
};

const ROLE_OPTIONS = [
  { value: "client_admin", label: "Admin do cliente" },
  { value: "client_user", label: "Usuario do cliente" },
  { value: "global_admin", label: "Admin global" },
];

const normalizeRole = (value?: string | null) => {
  if (value === "global_admin") return "global_admin";
  if (value === "client_admin" || value === "client_owner" || value === "client_manager") return "client_admin";
  return "client_user";
};

export function CreateUserModal({ open, clientId, clients, onClose, onCreated, users }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("client_user");
  const [jobTitle, setJobTitle] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [localClientId, setLocalClientId] = useState<string | null>(clientId);

  const requiresClient = role !== "global_admin";
  const canSubmit = useMemo(
    () => !!open && (!requiresClient || !!localClientId) && !!name.trim() && !!email.trim(),
    [open, requiresClient, localClientId, name, email],
  );

  useEffect(() => {
    setLocalClientId(clientId);
  }, [clientId]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        id: editingId ?? undefined,
        name: name.trim(),
        email: email.trim(),
        role,
        client_id: requiresClient ? localClientId : null,
        job_title: jobTitle.trim() || undefined,
        linkedin_url: linkedin.trim() || undefined,
        active,
      };
      const res = await fetch("/api/admin/users", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Erro ao salvar usuario");
        return;
      }
      setMessage(editingId ? "Usuario atualizado." : "Usuario criado. Convite enviado.");
      onCreated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar usuario";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setEmail("");
    setJobTitle("");
    setLinkedin("");
    setRole("client_user");
    setActive(true);
    setMessage(null);
    setError(null);
  }

  function selectUser(u: { id: string; name: string; job_title?: string | null; role?: string | null; client_id?: string | null; email?: string; linkedin_url?: string; active?: boolean }) {
    setEditingId(u.id);
    setName(u.name || "");
    setEmail((u as any).email || "");
    setJobTitle(u.job_title || "");
    setRole(normalizeRole(u.role));
    setLinkedin(u.linkedin_url || "");
    setActive(u.active ?? true);
    setLocalClientId(u.client_id ?? clientId ?? null);
    setMessage(null);
    setError(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 py-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs uppercase text-indigo-600">Usuario</p>
            <h3 className="text-lg font-semibold text-gray-900">{editingId ? "Editar usuario" : "Criar usuario"}</h3>
            <p className="text-sm text-gray-600">Vinculado a empresa selecionada.</p>
          </div>
          <button type="button" className="text-sm text-gray-500" onClick={() => { resetForm(); onClose(); }}>
            Fechar
          </button>
        </div>

        {requiresClient && !localClientId && (
          <p className="text-sm text-red-600 mb-3">Selecione uma empresa para criar usuario.</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.4fr] gap-4">
          <div className="rounded-lg border border-gray-200 p-3 space-y-2 max-h-[420px] overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">Pessoas vinculadas</span>
              <button
                className="text-xs text-indigo-700 hover:underline"
                onClick={() => resetForm()}
              >
                Novo
              </button>
            </div>
            {users && users.length === 0 && <p className="text-sm text-gray-500">Nenhum usuario vinculado.</p>}
            {users?.map((u) => (
              <button
                key={u.id}
                className={`w-full rounded border px-3 py-2 text-left ${editingId === u.id ? "border-indigo-400 bg-indigo-50" : "border-gray-200"}`}
                onClick={() => selectUser(u as any)}
              >
                <div className="text-sm font-medium">{u.name}</div>
                <div className="text-xs text-gray-500">{u.job_title ?? u.role ?? "Membro"}</div>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm sm:col-span-2">
                Empresa vinculada
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={localClientId ?? ""}
                  onChange={(e) => setLocalClientId(e.target.value || null)}
                >
                  <option value="">Selecione</option>
                  {clients?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Nome completo
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do usuario"
                  required
                />
              </label>
              <label className="block text-sm">
                Email
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@empresa.com"
                  required
                />
              </label>
              <label className="block text-sm">
                Cargo
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Cargo ou funcao"
                />
              </label>
              <label className="block text-sm">
                Perfil
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                LinkedIn
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://www.linkedin.com/in/usuario"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Ativo
              </label>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {message}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className="rounded border border-gray-200 px-4 py-2 text-sm" onClick={() => { resetForm(); onClose(); }}>
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={!canSubmit || loading}
              >
                {loading ? "Salvando..." : editingId ? "Salvar" : "Criar usuario"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
