"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { readApiError } from "@/lib/apiEnvelope";
import {
  editableProfileNeedsCompany,
  editableProfileUsesAutomaticCompany,
  normalizeEditableProfileRole,
} from "@/lib/editableProfileRoles";
import type { FixedProfileKind } from "@/lib/fixedProfilePresentation";
import { JOB_TITLE_OPTIONS } from "@/lib/jobTitles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Theme = "light" | "dark" | "system";
type Language = "pt-BR" | "en-US";

type ClientOption = { id: string; name: string };

type Props = {
  open: boolean;
  clientId: string | null;
  clients?: ClientOption[];
  userId?: string | null;
  mode?: "create" | "view" | "edit";
  initialData?: {
    name?: string | null;
    login?: string | null;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
    jobTitle?: string | null;
    linkedin?: string | null;
    avatarUrl?: string | null;
    clientId?: string | null;
    active?: boolean | null;
  };
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
  onUpdated?: () => void | Promise<void>;
  onUpdate?: (userId: string, payload: Record<string, unknown>) => void | Promise<void>;
  initialRole?: string;
  lockRole?: boolean;
  companyOptional?: boolean;
  showCompanyField?: boolean;
  requireCompanySelection?: boolean;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  allowedRoles?: FixedProfileKind[];
};

const ROLE_OPTIONS: Array<{ value: FixedProfileKind; label: string }> = [
  { value: "empresa", label: "Admin da empresa" },
  { value: "company_user", label: "Usuário da empresa" },
  { value: "testing_company_user", label: "Usuário TC" },
  { value: "leader_tc", label: "Lider TC" },
  { value: "technical_support", label: "Suporte Técnico" },
];
const EMPTY_JOB_TITLE = "__empty_job_title__";
type RoleValue = FixedProfileKind;

function isValidEmailAddress(value?: string | null) {
  const source = (value ?? "").trim();
  if (!source) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(source);
}

export function CreateUserModal({
  open,
  clientId,
  clients,
  userId = null,
  mode = "create",
  initialData,
  onClose,
  onCreated,
  onUpdated,
  onUpdate,
  initialRole = "testing_company_user",
  lockRole = false,
  showCompanyField = true,
  requireCompanySelection = false,
  title = "Criar usuário",
  subtitle = "Um convite será enviado por email.",
  submitLabel = "Criar usuário",
  allowedRoles,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<RoleValue>(() => normalizeEditableProfileRole(initialRole));
  const [jobTitle, setJobTitle] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [theme, setTheme] = useState<Theme>("system");
  const [language, setLanguage] = useState<Language>("pt-BR");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingLogin, setGeneratingLogin] = useState(false);
  const [isEditing, setIsEditing] = useState(mode !== "view");
  const [active, setActive] = useState(true);
  const [localClientId, setLocalClientId] = useState<string | null>(() => {
    if (initialData?.clientId) return initialData.clientId;
    if (clientId) return clientId;
    if (clients && clients.length === 1) return clients[0].id;
    return null;
  });

  const effectiveMode = mode === "view" && isEditing ? "edit" : mode;
  const isViewMode = effectiveMode === "view";
  const isCreateMode = effectiveMode === "create";

  const normalizedRole = useMemo(() => normalizeEditableProfileRole(role), [role]);
  const roleOptions = useMemo(
    () =>
      allowedRoles?.length
        ? ROLE_OPTIONS.filter((option) => allowedRoles.includes(option.value))
        : ROLE_OPTIONS,
    [allowedRoles],
  );
  const requiresClient = useMemo(
    () =>
      showCompanyField &&
      (requireCompanySelection ||
        (editableProfileNeedsCompany(normalizedRole) &&
          !editableProfileUsesAutomaticCompany(normalizedRole))),
    [showCompanyField, requireCompanySelection, normalizedRole],
  );
  const requiresPassword = useMemo(
    () => isCreateMode && normalizedRole === "leader_tc",
    [isCreateMode, normalizedRole],
  );
  const canSubmit = useMemo(
    () =>
      !!open &&
      (!requiresClient || !!localClientId) &&
      !!name.trim() &&
      isValidEmailAddress(email) &&
      (!requiresPassword || password.trim().length >= 8),
    [open, requiresClient, localClientId, name, email, requiresPassword, password],
  );

  useEffect(() => {
    if (clientId) {
      setLocalClientId(clientId);
      return;
    }
    if (clients && clients.length === 1) {
      setLocalClientId(clients[0].id);
      return;
    }
    setLocalClientId(null);
  }, [clientId, clients]);

  useEffect(() => {
    if (!open) return;
    setIsEditing(mode !== "view");
    applyInitialForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    if (mode === "create") return;
    if (!userId) return;

    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/settings`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as { settings?: { theme?: string; language?: string } } | null;
        if (!mounted) return;

        const nextTheme = data?.settings?.theme;
        const nextLanguage = data?.settings?.language;
        if (nextTheme === "light" || nextTheme === "dark" || nextTheme === "system") {
          setTheme(nextTheme);
        }
        if (nextLanguage === "pt-BR" || nextLanguage === "en-US") {
          setLanguage(nextLanguage);
        }
      } catch {
        // keep modal usable even if settings lookup fails
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, mode, userId]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  function handleUnauthorized() {
    const msg = "Sessão expirada. Faça login novamente.";
    setError(msg);
    toast.error(msg);
    router.push("/login");
  }

  async function handleGenerateLogin() {
    const seed = (name || email || "usuario").trim();
    if (!seed) return;
    setGeneratingLogin(true);
    try {
      const response = await fetch("/api/me/username-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ seed, avoid: login ? [login] : [] }),
      });
      const payload = (await response.json().catch(() => null)) as { username?: string; error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível gerar o usuário.");
      }
      const generated = (payload?.username ?? "").trim().toLowerCase();
      if (generated) setLogin(generated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível gerar o usuário.";
      toast.error(message);
    } finally {
      setGeneratingLogin(false);
    }
  }

  async function syncUserSettings(targetUserId: string) {
    if (!targetUserId) return;
    try {
      await fetch(`/api/admin/users/${encodeURIComponent(targetUserId)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ theme, language }),
      }).catch(() => null);
    } catch {
      // silent: settings sync is best-effort
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!isValidEmailAddress(email)) {
        setError("Informe um e-mail valido para continuar.");
        return;
      }
      const payload = {
        full_name: name.trim(),
        name: name.trim(),
        ...(login.trim() ? { user: login.trim() } : {}),
        ...(isCreateMode && password.trim() ? { password: password.trim() } : {}),
        email: email.trim(),
        phone: phone.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        role,
        client_id: localClientId,
        job_title: jobTitle.trim() || undefined,
        linkedin_url: linkedin.trim() || undefined,
        active,
      };
      if (isCreateMode) {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (res.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!res.ok) {
          const err = await readApiError(res, "Erro ao salvar usuário");
          setError(err.message);
          toast.error(err.displayMessage);
          return;
        }
        const createdPayload = (await res.json().catch(() => null)) as { id?: string; user?: { id?: string } } | null;
        const createdUserId =
          (typeof createdPayload?.id === "string" ? createdPayload.id : "") ||
          (typeof createdPayload?.user?.id === "string" ? createdPayload.user.id : "");

        await syncUserSettings(createdUserId);

        const okMsg = "Usuário criado. Convite enviado.";
        setMessage(okMsg);
        toast.success(okMsg);
        resetForm();
        onClose();
        try {
          await onCreated?.();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erro ao atualizar lista de usuários";
          setError(msg);
          toast.error(msg);
        }
      } else {
        if (!userId) {
          setError("Usuário inválido para atualização");
          return;
        }
        if (onUpdate) {
          await onUpdate(userId, payload);
        } else {
          const res = await fetch(`/api/admin/users/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          });
          if (res.status === 401) {
            handleUnauthorized();
            return;
          }
          if (!res.ok) {
            const err = await readApiError(res, "Erro ao atualizar usuário");
            setError(err.message);
            toast.error(err.displayMessage);
            return;
          }
        }
        await syncUserSettings(userId ?? "");
        toast.success("Usuário atualizado com sucesso.");
        onClose();
        try {
          await onUpdated?.();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erro ao atualizar lista de usuários";
          setError(msg);
          toast.error(msg);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar usuário";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setLogin("");
    setPassword("");
    setEmail("");
    setPhone("");
    setJobTitle("");
    setLinkedin("");
    setAvatarUrl("");
    setTheme("system");
    setLanguage("pt-BR");
    setRole(normalizeEditableProfileRole(initialRole));
    setActive(true);
    if (clientId) setLocalClientId(clientId);
    else if (clients && clients.length === 1) setLocalClientId(clients[0].id);
    setMessage(null);
    setError(null);
  }

  function applyInitialForm() {
    setMessage(null);
    setError(null);
    if (mode === "create") {
      resetForm();
      return;
    }
    setName(initialData?.name ?? "");
    setLogin(initialData?.login ?? "");
    setPassword("");
    setEmail(initialData?.email ?? "");
    setPhone(initialData?.phone ?? "");
    setJobTitle(initialData?.jobTitle ?? "");
    setLinkedin(initialData?.linkedin ?? "");
    setAvatarUrl(initialData?.avatarUrl ?? "");
    setTheme("system");
    setLanguage("pt-BR");
    setRole(normalizeEditableProfileRole(initialData?.role ?? initialRole));
    setActive(initialData?.active ?? true);
    if (initialData?.clientId) setLocalClientId(initialData.clientId);
    else if (clientId) setLocalClientId(clientId);
    else if (clients && clients.length === 1) setLocalClientId(clients[0].id);
    else setLocalClientId(null);
  }

  function handleCloseOrCancel() {
    // From view->edit, cancel returns to read-only view.
    if (mode === "view" && isEditing) {
      setIsEditing(false);
      return;
    }

    // In create/edit flows, cancel should close the modal.
    resetForm();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 py-4 overflow-y-auto" role="dialog" aria-modal="true" data-testid="create-user-modal">
      <div className="my-auto w-full max-w-4xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs uppercase text-indigo-600">Usuário</p>
            <h3 className="text-lg font-semibold text-gray-900">{isViewMode ? "Visualizar usuário" : title}</h3>
            <p className="text-sm text-gray-600">{subtitle}</p>
          </div>
          <button type="button" className="text-sm text-gray-500" onClick={handleCloseOrCancel}>
            Fechar
          </button>
        </div>

        {requiresClient && !localClientId && (
          <p className="text-sm text-red-600 mb-3">Selecione uma empresa para criar usuário.</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3" data-testid="create-user-form">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {showCompanyField ? (
              <label className="block text-sm sm:col-span-2">
                Empresa vinculada
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={localClientId ?? ""}
                  onChange={(e) => setLocalClientId(e.target.value || null)}
                  aria-label="Empresa vinculada ao usuário"
                  data-testid="create-user-company"
                  disabled={isViewMode}
                >
                  <option value="">{requiresClient ? "Selecione" : "Opcional"}</option>
                  {clients?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              ) : null}
              <label className="block text-sm">
                Nome completo
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="create-user-name"
                  placeholder="Nome do usuário"
                  required
                  disabled={isViewMode}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                Usuário (login)
                <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    data-testid="create-user-login"
                    placeholder="Se deixar em branco, o sistema gera"
                    disabled={isViewMode}
                  />
                  <button
                    type="button"
                    onClick={() => void handleGenerateLogin()}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 disabled:opacity-60"
                    disabled={isViewMode || generatingLogin || !name.trim()}
                  >
                    {generatingLogin ? "Gerando..." : "Gerar login"}
                  </button>
                </div>
                <span className="mt-1 block text-xs text-gray-500">Único no sistema. Deixe em branco para o sistema gerar automaticamente.</span>
              </label>
              {requiresPassword ? (
                <label className="block text-sm">
                  Senha
                  <input
                    type="password"
                    minLength={8}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="create-user-password"
                    placeholder="Mínimo 8 caracteres"
                    required
                    disabled={isViewMode}
                  />
                  <span className="mt-1 block text-xs text-gray-500">Obrigatória para criar Lider TC.</span>
                </label>
              ) : null}
              <label className="block text-sm">
                Email *
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="create-user-email"
                  placeholder="email@empresa.com"
                  required
                  disabled={isViewMode}
                />
              </label>
              <label className="block text-sm">
                Telefone
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  data-testid="create-user-phone"
                  placeholder="+55 11 99999-9999"
                  disabled={isViewMode}
                />
              </label>
              <label className="block text-sm">
                Cargo
                <div className="mt-1">
                  <Select
                    value={jobTitle || EMPTY_JOB_TITLE}
                    onValueChange={(value) => {
                      if (isViewMode) return;
                      setJobTitle(value === EMPTY_JOB_TITLE ? "" : value);
                    }}
                  >
                    <SelectTrigger className="h-10.5 rounded-lg border-gray-200 bg-white px-3 py-2 text-sm focus-visible:ring-indigo-500/30" disabled={isViewMode}>
                      <SelectValue placeholder="Selecione uma profissão" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      <SelectItem value={EMPTY_JOB_TITLE}>Não informado</SelectItem>
                      {JOB_TITLE_OPTIONS.map((jobTitleOption) => (
                        <SelectItem key={jobTitleOption} value={jobTitleOption}>
                          {jobTitleOption}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </label>
              {!lockRole ? (
                <label className="block text-sm">
                  Perfil
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    value={role}
                    onChange={(e) => setRole(normalizeEditableProfileRole(e.target.value))}
                    data-testid="create-user-role"
                    disabled={isViewMode}
                  >
                    {roleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block text-sm">
                LinkedIn
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://www.linkedin.com/in/usuário"
                  disabled={isViewMode}
                />
              </label>
              <label className="block text-sm">
                Foto (URL)
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  disabled={isViewMode}
                />
              </label>
              <div className="block text-sm">
                Foto atual
                <div className="mt-1 flex h-10.5 items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3">
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
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={isViewMode} />
                Ativo
              </label>
              <label className="block text-sm">
                Tema
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as Theme)}
                  disabled={isViewMode}
                >
                  <option value="system">Sistema</option>
                  <option value="light">Claro</option>
                  <option value="dark">Escuro</option>
                </select>
              </label>
              <label className="block text-sm">
                Idioma
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  disabled={isViewMode}
                >
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en-US">English (USA)</option>
                </select>
              </label>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {message}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className="rounded border border-gray-200 px-4 py-2 text-sm" onClick={handleCloseOrCancel}>
                {isViewMode ? "Fechar" : "Cancelar"}
              </button>
              {isViewMode ? (
                <button
                  type="button"
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => setIsEditing(true)}
                >
                  Editar
                </button>
              ) : (
                <button
                  type="submit"
                  data-testid="create-user-submit"
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={!canSubmit || loading}
                >
                  {loading ? (isCreateMode ? "Criando..." : "Salvando...") : (isCreateMode ? submitLabel : "Salvar mudanças")}
                </button>
              )}
            </div>
        </form>
      </div>
    </div>
  );
}
