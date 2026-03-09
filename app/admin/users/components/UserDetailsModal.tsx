"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { useAuthUser } from "@/hooks/useAuthUser";
import { JOB_TITLE_OPTIONS } from "@/lib/jobTitles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ClientOption = { id: string; name: string };

type UserItem = {
  id: string;
  name: string;
  email?: string;
  user?: string;
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
  { value: "client_admin", label: "Empresa" },
  { value: "client_user", label: "Usuario" },
  { value: "it_dev", label: "Global" },
  { value: "global_admin", label: "Admin" },
] as const;
const EMPTY_JOB_TITLE = "__empty_job_title__";

type RoleValue = (typeof ROLE_OPTIONS)[number]["value"];

const normalizeRole = (value?: string | null): RoleValue => {
  if (value === "global_admin") return "global_admin";
  if (value === "it_dev" || value === "developer" || value === "dev") return "it_dev";
  if (value === "client_admin" || value === "client_owner" || value === "client_manager") return "client_admin";
  return "client_user";
};

function isGlobalDeveloperUser(
  user?: { role?: string | null; permissionRole?: string | null; companyRole?: string | null } | null,
) {
  const role = (user?.role ?? "").toLowerCase();
  const permissionRole = (user?.permissionRole ?? "").toLowerCase();
  const companyRole = (user?.companyRole ?? "").toLowerCase();
  return role === "it_dev" || permissionRole === "dev" || companyRole === "it_dev";
}

function isDirty(a: {
  name: string;
  login: string;
  email: string;
  role: RoleValue;
  clientId: string | null;
  jobTitle: string;
  linkedin: string;
  avatarUrl: string;
  active: boolean;
}, b: {
  name: string;
  login: string;
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
    a.login !== b.login ||
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
  const router = useRouter();
  const { user: authUser } = useAuthUser();
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
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
        login: "",
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
      login: (u.user ?? u.email ?? "").toString(),
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
    () => ({ name, login, email, role, clientId, jobTitle, linkedin, avatarUrl, active }),
    [name, login, email, role, clientId, jobTitle, linkedin, avatarUrl, active],
  );

  const dirty = useMemo(() => isDirty(initial, draft), [initial, draft]);
  const canManagePrivilegedProfiles = useMemo(() => isGlobalDeveloperUser(authUser), [authUser]);
  const availableRoleOptions = useMemo(() => {
    if (canManagePrivilegedProfiles) return ROLE_OPTIONS;
    return ROLE_OPTIONS.filter((option) => option.value !== "it_dev" && option.value !== "global_admin");
  }, [canManagePrivilegedProfiles]);
  const canEditRole = canManagePrivilegedProfiles || (role !== "it_dev" && role !== "global_admin");

  const requiresClient = false;
  const canSave =
    !!user?.id &&
    dirty &&
    (!requiresClient || !!clientId) &&
    !!name.trim() &&
    !!login.trim() &&
    !!email.trim();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(initial.name);
    setLogin(initial.login);
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

  function handleUnauthorized() {
    const msg = "Sessão expirada. Faça login novamente.";
    setError(msg);
    toast.error(msg);
    router.push("/login");
  }

  async function save() {
    if (!canSave || loading) return;
    setLoading(true);
    setError(null);

    try {
      const payload = {
        id: user.id,
        name: name.trim(),
        user: login.trim(),
        email: email.trim(),
        role,
        client_id: clientId,
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

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

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
              aria-label="Empresa vinculada ao usuário"
            >
              <option value="">{requiresClient ? "Selecione" : "Opcional"}</option>
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
            Usuario (login)
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
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
            <div className="mt-1">
              <Select
                value={jobTitle || EMPTY_JOB_TITLE}
                onValueChange={(value) => setJobTitle(value === EMPTY_JOB_TITLE ? "" : value)}
              >
                <SelectTrigger className="h-[42px] rounded-lg border-gray-200 bg-white px-3 py-2 text-sm focus-visible:ring-indigo-500/30">
                  <SelectValue placeholder="Selecione uma profissao" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value={EMPTY_JOB_TITLE}>Nao informado</SelectItem>
                  {JOB_TITLE_OPTIONS.map((jobTitleOption) => (
                    <SelectItem key={jobTitleOption} value={jobTitleOption}>
                      {jobTitleOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </label>

          <label className="block text-sm">
            Perfil
            {canEditRole ? (
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={role}
                onChange={(e) => {
                  const next = e.target.value as RoleValue;
                  setRole(next);
                }}
                aria-label="Perfil do usuário"
                title="Perfil"
              >
                {availableRoleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <div
                className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                title="Somente Global pode alterar perfis privilegiados."
              >
                {ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role}
              </div>
            )}
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

          <div className="block text-sm sm:col-span-2">
            Foto atual
            <div className="mt-1 flex h-[42px] items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3">
              {avatarUrl.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl.trim()} alt="Preview da foto" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
                  {name.trim().slice(0, 1).toUpperCase() || "U"}
                </div>
              )}
              <span className="text-xs text-gray-500">
                {avatarUrl.trim() ? "Preview da foto informada" : "Nenhuma foto informada"}
              </span>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Ativo
          </label>
        </div>

        {requiresClient && !clientId && <p className="text-sm text-red-600 mt-3">Empresa e obrigatoria.</p>}
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

