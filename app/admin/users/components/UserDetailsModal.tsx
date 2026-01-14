"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

type ClientOption = { id: string; name: string };

type UserItem = {
  id: string;
  name: string;
  email?: string;
  role?: string;
  job_title?: string | null;
  client_id?: string | null;
  active?: boolean;
  linkedin_url?: string;
  avatar_url?: string | null;
};

type Props = {
  open: boolean;
  user: UserItem | null;
  clients?: ClientOption[];
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
};

const ROLE_OPTIONS = [
  { value: "client_admin", label: "Admin do cliente" },
  { value: "client_user", label: "Usuario do cliente" },
  { value: "global_admin", label: "Admin global" },
] as const;

type RoleValue = (typeof ROLE_OPTIONS)[number]["value"];

const normalizeRole = (value?: string | null): RoleValue => {
  if (value === "global_admin") return "global_admin";
  if (value === "client_admin" || value === "client_owner" || value === "client_manager") return "client_admin";
  return "client_user";
};

function isDirty(a: {
  name: string;
  email: string;
  role: RoleValue;
  clientId: string | null;
  jobTitle: string;
  linkedin: string;
  avatarUrl: string;
  active: boolean;
}, b: {
  name: string;
  email: string;
  role: RoleValue;
  clientId: string | null;
  jobTitle: string;
  linkedin: string;
  avatarUrl: string;
  active: boolean;
}) {
  return (
    a.name !== b.name ||
    a.email !== b.email ||
    a.role !== b.role ||
    a.clientId !== b.clientId ||
    a.jobTitle !== b.jobTitle ||
    a.linkedin !== b.linkedin ||
    a.avatarUrl !== b.avatarUrl ||
    a.active !== b.active
  );
}

export function UserDetailsModal({ open, user, clients, onClose, onSaved, onDirtyChange }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleValue>("client_user");
  const [jobTitle, setJobTitle] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [active, setActive] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const initial = useMemo(() => {
    const u = user;
    if (!u) {
      return {
        name: "",
        email: "",
        role: "client_user" as RoleValue,
        clientId: null as string | null,
        jobTitle: "",
        linkedin: "",
        avatarUrl: "",
        active: true,
      };
    }

    return {
      name: u.name ?? "",
      email: (u.email ?? "").toString(),
      role: normalizeRole(u.role ?? null),
      clientId: u.client_id ?? null,
      jobTitle: u.job_title ?? "",
      linkedin: u.linkedin_url ?? "",
      avatarUrl: (u.avatar_url ?? "") || "",
      active: u.active ?? true,
    };
  }, [user]);

  const draft = useMemo(
    () => ({ name, email, role, clientId, jobTitle, linkedin, avatarUrl, active }),
    [name, email, role, clientId, jobTitle, linkedin, avatarUrl, active],
  );

  const dirty = useMemo(() => isDirty(initial, draft), [initial, draft]);

  const requiresClient = role !== "global_admin";
  const canSave = !!user?.id && dirty && (!requiresClient || !!clientId) && !!name.trim() && !!email.trim();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(initial.name);
    setEmail(initial.email);
    setRole(initial.role);
    setClientId(initial.clientId);
    setJobTitle(initial.jobTitle);
    setLinkedin(initial.linkedin);
    setAvatarUrl(initial.avatarUrl);
    setActive(initial.active);
  }, [open, initial]);

  useEffect(() => {
    onDirtyChange?.(open && dirty);
  }, [open, dirty, onDirtyChange]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !user) return null;

  async function save() {
    if (!canSave || loading) return;
    setLoading(true);
    setError(null);

    try {
      const payload = {
        id: user.id,
        name: name.trim(),
        email: email.trim(),
        role,
        client_id: role === "global_admin" ? null : clientId,
        job_title: jobTitle.trim() || undefined,
        linkedin_url: linkedin.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        active,
      };

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok) {
        const msg = (json.error as string) || "Erro ao salvar usuario";
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success("Usuario atualizado.");
      await onSaved?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar usuario";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 py-4 overflow-y-auto" role="presentation">
      <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs uppercase text-indigo-600">Usuario</p>
            <h3 className="text-lg font-semibold text-gray-900">Detalhes</h3>
            <p className="text-sm text-gray-600">Edite dados e vinculo com empresa.</p>
          </div>
          <button type="button" className="text-sm text-gray-500" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            Empresa vinculada
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={clientId ?? ""}
              onChange={(e) => setClientId(e.target.value || null)}
              disabled={role === "global_admin"}
              aria-label="Empresa vinculada ao usuário"
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
              required
            />
          </label>

          <label className="block text-sm">
            Cargo
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            Perfil
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={role}
              onChange={(e) => {
                const next = e.target.value as RoleValue;
                setRole(next);
                if (next === "global_admin") setClientId(null);
              }}
              aria-label="Perfil do usuário"
              title="Perfil"
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

          <label className="block text-sm sm:col-span-2">
            Foto (URL)
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
            />
          </label>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Ativo
          </label>
        </div>

        {requiresClient && !clientId && <p className="text-sm text-red-600 mt-3">Empresa e obrigatoria para este perfil.</p>}
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="text-xs text-gray-500">{dirty ? "Alteracoes nao salvas" : "Sem alteracoes"}</div>
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded border border-gray-200 px-4 py-2 text-sm" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={!canSave || loading}
              onClick={save}
            >
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
