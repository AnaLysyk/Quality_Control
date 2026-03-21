"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import UserAvatar from "@/components/UserAvatar";
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
  onDeleted?: () => void | Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
};

const ROLE_OPTIONS = [
  { value: "client_admin", label: "Empresa" },
  { value: "client_user", label: "Usuario" },
  { value: "leader_tc", label: "Lider TC" },
  { value: "technical_support", label: "Suporte Tecnico" },
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

export function UserDetailsModal({ open, user, clients, onClose, onSaved, onDeleted, onDirtyChange }: Props) {
  const router = useRouter();
  const { user: authUser, refreshUser } = useAuthUser();
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
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    !!email.trim();
  const roleLabel = ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
  const linkedCompanyName =
    clients?.find((client) => client.id === clientId)?.name ?? (clientId ? "Empresa vinculada" : "Sem empresa");
  const displayName = name.trim() || user?.name || "Usuario";
  const displayLogin = login.trim() || user?.user || "sem-login";
  const displayEmail = email.trim() || user?.email || "Sem e-mail";
  const displayJobTitle = jobTitle.trim() || "Cargo nao informado";
  const stateLabel = loading ? "Salvando alteracoes" : dirty ? "Alteracoes pendentes" : "Sincronizado";
  const stateToneClass = loading
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : dirty
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const fieldClass =
    "mt-2 w-full rounded-2xl border border-[#d8dfeb] bg-white px-4 py-3 text-sm font-medium text-[#081f4d] shadow-[0_8px_18px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-[#7b8eb5] focus:border-(--tc-accent) focus:ring-4 focus:ring-[#ef0001]/10";
  const sectionTitleClass = "text-[11px] font-extrabold uppercase tracking-[0.22em] text-(--tc-accent)";
  const labelClass = "text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ef0001]";

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
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

  async function deleteUser() {
    if (!user?.id || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const msg = (json.error as string) || "Erro ao excluir usuario";
        setError(msg);
        toast.error(msg);
        setConfirmDelete(false);
        return;
      }
      toast.success("Usuario excluido.");
      await onDeleted?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir usuario";
      setError(msg);
      toast.error(msg);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  function handleUnauthorized() {
    const msg = "Sessao expirada. Faca login novamente.";
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
        full_name: name.trim(),
        user: login.trim(),
        email: email.trim(),
        role,
        client_id: clientId,
        job_title: jobTitle.trim() || undefined,
        linkedin_url: linkedin.trim() || undefined,
        avatar_url: avatarUrl.trim() || null,
        active,
      };

      const res = await fetch(`/api/admin/users/${user.id}`, {
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

      if (authUser?.id && authUser.id === user.id) {
        await refreshUser();
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
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 px-4 py-5 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="mx-auto w-full max-w-5xl max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-hidden rounded-[28px] border border-[#d7e0ef] bg-[#fcfdff] shadow-[0_32px_90px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[#e3e8f2] bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_100%)] px-6 py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <UserAvatar
                src={avatarUrl.trim() || null}
                name={displayName}
                size="lg"
                className="h-20 w-20 shrink-0"
                frameClassName="border border-[#d7e0ef] bg-white shadow-[0_18px_34px_rgba(15,23,42,0.12)] ring-0"
                fallbackClassName="text-base font-extrabold tracking-[0.18em] text-[#081f4d]"
              />

              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-(--tc-accent)">Painel do usuario</p>
                <h3 className="wrap-break-word text-[1.8rem] font-extrabold leading-tight text-[#081f4d]">{displayName}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-[#27457d]">
                  <span>@{displayLogin}</span>
                  <span className="hidden h-1 w-1 rounded-full bg-[#9ab0d8] sm:inline-block" />
                  <span className="break-all">{displayEmail}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#f3bcc5] bg-[#fff4f5] px-3 py-1 text-xs font-bold text-(--tc-accent)">
                    {roleLabel}
                  </span>
                  <span className="rounded-full border border-[#c9d7ef] bg-white px-3 py-1 text-xs font-bold text-[#081f4d]">
                    {active ? "Ativo" : "Inativo"}
                  </span>
                  <span className="rounded-full border border-[#c9d7ef] bg-white px-3 py-1 text-xs font-bold text-[#081f4d]">
                    {linkedCompanyName}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#d7e0ef] bg-white px-4 text-sm font-semibold text-[#5a6f97] shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:border-(--tc-accent) hover:text-(--tc-accent)"
              onClick={onClose}
            >
              Fechar
            </button>
          </div>

          <div className="mt-5 rounded-[22px] border border-[#ffd7de] bg-[linear-gradient(135deg,#fff6f8_0%,#fffafb_100%)] px-4 py-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-(--tc-accent)">Sincronizacao ativa</p>
            <p className="mt-2 text-sm font-medium leading-6 text-[#27457d]">
              Este painel administrativo edita os mesmos dados exibidos no perfil do usuario. O que for salvo aqui
              aparece no perfil, e o que for alterado no perfil aparece aqui.
            </p>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <div className="space-y-5">
            <section className="rounded-3xl border border-[#d7e0ef] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
              <p className={sectionTitleClass}>Identidade</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className={labelClass}>Nome completo</span>
                  <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
                </label>

                <label className="block text-sm">
                  <span className={labelClass}>Usuario (login)</span>
                  <input
                    className={fieldClass}
                    value={login}
                    onChange={(event) => setLogin(event.target.value)}
                    placeholder="Se deixar em branco, gera automaticamente"
                  />
                  <span className="mt-2 block text-xs font-semibold text-[#5f77a2]">
                    Unico no sistema. Se ficar vazio, sera gerado automaticamente.
                  </span>
                </label>

                <label className="block text-sm">
                  <span className={labelClass}>Email</span>
                  <input
                    type="email"
                    className={fieldClass}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>

                <label className="block text-sm">
                  <span className={labelClass}>LinkedIn</span>
                  <input
                    className={fieldClass}
                    value={linkedin}
                    onChange={(event) => setLinkedin(event.target.value)}
                    placeholder="https://www.linkedin.com/in/usuario"
                  />
                </label>

                <label className="block text-sm md:col-span-2">
                  <span className={labelClass}>Cargo</span>
                  <div className="mt-2">
                    <Select value={jobTitle || EMPTY_JOB_TITLE} onValueChange={(value) => setJobTitle(value === EMPTY_JOB_TITLE ? "" : value)}>
                      <SelectTrigger className="h-12.5 rounded-2xl border-[#d8dfeb] bg-white px-4 text-sm font-medium text-[#081f4d] shadow-[0_8px_18px_rgba(15,23,42,0.04)] focus-visible:border-(--tc-accent) focus-visible:ring-4 focus-visible:ring-[#ef0001]/10">
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
              </div>
            </section>

            <section className="rounded-3xl border border-[#d7e0ef] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
              <p className={sectionTitleClass}>Acesso e vinculo</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm md:col-span-2">
                  <span className={labelClass}>Empresa vinculada</span>
                  <select
                    className={fieldClass}
                    value={clientId ?? ""}
                    onChange={(event) => setClientId(event.target.value || null)}
                    aria-label="Empresa vinculada ao usuario"
                  >
                    <option value="">{requiresClient ? "Selecione" : "Sem empresa vinculada"}</option>
                    {clients?.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className={labelClass}>Perfil</span>
                  {canEditRole ? (
                    <select
                      className={fieldClass}
                      value={role}
                      onChange={(event) => setRole(event.target.value as RoleValue)}
                      aria-label="Perfil do usuario"
                      title="Perfil"
                    >
                      {availableRoleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className={`${fieldClass} flex items-center bg-[#f7faff] text-[#4f658d]`} title="Somente Global pode alterar perfis privilegiados.">
                      {roleLabel}
                    </div>
                  )}
                </label>

                <label className="block text-sm">
                  <span className={labelClass}>Status do acesso</span>
                  <label className="mt-2 flex min-h-12.5 cursor-pointer items-center gap-3 rounded-2xl border border-[#d8dfeb] bg-white px-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(event) => setActive(event.target.checked)}
                      className="h-4 w-4 accent-[#ef0001]"
                    />
                    <span className="text-sm font-semibold text-[#081f4d]">{active ? "Usuario ativo" : "Usuario inativo"}</span>
                  </label>
                </label>
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-3xl border border-[#d7e0ef] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
              <p className={sectionTitleClass}>Foto do perfil</p>
              <div className="mt-4 rounded-[22px] border border-[#d9e1ef] bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_100%)] p-5 text-center">
                <UserAvatar
                  src={avatarUrl.trim() || null}
                  name={displayName}
                  size="lg"
                  className="mx-auto h-28 w-28"
                  frameClassName="border border-[#d3dceb] bg-white shadow-[0_18px_34px_rgba(15,23,42,0.12)] ring-0"
                  fallbackClassName="text-lg font-extrabold tracking-[0.18em] text-[#081f4d]"
                />
                <p className="mt-4 text-sm font-bold text-[#081f4d]">{displayJobTitle}</p>
                <p className="mt-1 text-xs font-medium leading-5 text-[#5f77a2]">
                  O avatar salvo aqui e o mesmo usado na capa e no perfil do usuario.
                </p>
              </div>

              <label className="mt-4 block text-sm">
                <span className={labelClass}>Foto por URL</span>
                <input
                  className={fieldClass}
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                />
              </label>
            </section>

            <section className="rounded-3xl border border-[#d7e0ef] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
              <p className={sectionTitleClass}>Estado da edicao</p>
              <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${stateToneClass}`}>
                {stateLabel}
              </div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[#4f658d]">
                <p>
                  Perfil: <span className="font-semibold text-[#081f4d]">{roleLabel}</span>
                </p>
                <p>
                  Empresa: <span className="font-semibold text-[#081f4d]">{linkedCompanyName}</span>
                </p>
                <p>
                  Status: <span className="font-semibold text-[#081f4d]">{active ? "Ativo" : "Inativo"}</span>
                </p>
              </div>
            </section>
          </div>
        </div>

        {(requiresClient && !clientId) || error ? (
          <div className="px-6 pb-2">
            {requiresClient && !clientId ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                Empresa e obrigatoria.
              </p>
            ) : null}
            {error ? (
              <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-[#e3e8f2] bg-[#fbfcff] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {confirmDelete ? (
              <>
                <span className="text-sm font-semibold text-rose-700">Confirmar exclusao?</span>
                <button
                  type="button"
                  className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={deleting}
                  onClick={deleteUser}
                >
                  {deleting ? "Excluindo..." : "Sim, excluir"}
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-[#d7e0ef] bg-white px-4 py-2 text-sm font-semibold text-[#4f658d] transition hover:border-(--tc-accent) hover:text-(--tc-accent)"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                type="button"
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                onClick={() => setConfirmDelete(true)}
              >
                Excluir usuario
              </button>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="rounded-2xl border border-[#d7e0ef] bg-white px-5 py-2.5 text-sm font-semibold text-[#4f658d] transition hover:border-(--tc-accent) hover:text-(--tc-accent)"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-2xl bg-[#0b1f52] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-(--tc-accent) disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canSave || loading}
              onClick={save}
            >
              {loading ? "Salvando..." : "Salvar alteracoes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
