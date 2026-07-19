"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { readApiError } from "@/backend/apiEnvelope";
import {
  editableProfileNeedsCompany,
  editableProfileUsesAutomaticCompany,
  normalizeEditableProfileRole,
} from "@/backend/editableProfileRoles";
import type { FixedProfileKind } from "@/backend/fixedProfilePresentation";
import { JOB_TITLE_OPTIONS } from "@/backend/jobTitles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import UserAvatar from "@/components/UserAvatar";
import { AvatarLibraryDialog, type AvatarLibraryChoice } from "@/components/AvatarLibraryDialog";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";

type Theme = "light" | "dark" | "system";
type Language = "pt-BR" | "en-US";

type ClientOption = { id: string; name: string; slug?: string | null };

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
  { value: "leader_tc", label: "Líder TC" },
  { value: "technical_support", label: "Administrador" },
];
const EMPTY_JOB_TITLE = "__empty_job_title__";
type RoleValue = FixedProfileKind;

function isValidEmailAddress(value?: string | null) {
  const source = (value ?? "").trim();
  if (!source) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(source);
}

function resolveAvatarLibraryKind(value?: string | null): AvatarLibraryChoice["avatarKind"] {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return "default";
  if (!/^(https?:\/\/|\/|blob:|data:)/i.test(normalized)) return "emoji";
  if (/\.gif(?:$|\?)/i.test(normalized) || normalized.includes("media.giphy.com")) return "gif";
  return "image";
}

function optionFromAuthCompany(company: { id?: string; name?: string; slug?: string | null }): ClientOption | null {
  if (!company.id || !company.name) return null;
  return { id: company.id, name: company.name, slug: company.slug ?? null };
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
  subtitle = "O acesso sera confirmado por e-mail com senha temporaria.",
  submitLabel = "Criar usuário",
  allowedRoles,
}: Props) {
  const router = useRouter();
  const { accessContext, companies: authCompanies } = usePermissionAccess();

  const authCompanyOptions = useMemo(
    () => authCompanies.map(optionFromAuthCompany).filter((item): item is ClientOption => Boolean(item)),
    [authCompanies],
  );
  const rawClientOptions = useMemo(
    () => (clients && clients.length > 0 ? clients : authCompanyOptions),
    [authCompanyOptions, clients],
  );
  const isCompanyProfile = accessContext?.profileKind === "empresa";
  const profileCompanyId = accessContext?.companyId ?? null;
  const profileCompanySlugs = useMemo(() => new Set(accessContext?.companySlugs ?? []), [accessContext?.companySlugs]);
  const availableClients = useMemo(() => {
    if (!isCompanyProfile) return rawClientOptions;

    const filtered = rawClientOptions.filter((company) => {
      if (profileCompanyId && company.id === profileCompanyId) return true;
      if (company.slug && profileCompanySlugs.has(company.slug)) return true;
      return false;
    });

    if (filtered.length > 0) return filtered;
    return authCompanyOptions.length > 0 ? authCompanyOptions : rawClientOptions.slice(0, 1);
  }, [authCompanyOptions, isCompanyProfile, profileCompanyId, profileCompanySlugs, rawClientOptions]);
  const fixedCompany = isCompanyProfile ? availableClients[0] ?? null : null;

  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<RoleValue>(() => normalizeEditableProfileRole(initialRole));
  const [jobTitle, setJobTitle] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarLibraryOpen, setAvatarLibraryOpen] = useState(false);
  const [avatarLabel, setAvatarLabel] = useState("Sem foto");
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
  const selectedCompany = useMemo(
    () => availableClients.find((company) => company.id === localClientId) ?? fixedCompany ?? null,
    [availableClients, fixedCompany, localClientId],
  );
  const shouldRenderFixedCompany = showCompanyField && isCompanyProfile && Boolean(selectedCompany);
  const canSubmit = useMemo(
    () =>
      !!open &&
      (!requiresClient || !!localClientId) &&
      !!name.trim() &&
      isValidEmailAddress(email),
    [open, requiresClient, localClientId, name, email],
  );

  const avatarKind = useMemo(() => resolveAvatarLibraryKind(avatarUrl), [avatarUrl]);
  const avatarPreviewName = name || email || login || "Usuário";

  useEffect(() => {
    if (!open) return;
    if (isCompanyProfile && fixedCompany?.id) {
      setLocalClientId(fixedCompany.id);
      return;
    }
    if (clientId) {
      setLocalClientId(clientId);
      return;
    }
    if (availableClients.length === 1) {
      setLocalClientId(availableClients[0].id);
      return;
    }
    setLocalClientId(null);
  }, [availableClients, clientId, fixedCompany?.id, isCompanyProfile, open]);

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
        if (nextTheme === "light" || nextTheme === "dark" || nextTheme === "system") setTheme(nextTheme);
        if (nextLanguage === "pt-BR" || nextLanguage === "en-US") setLanguage(nextLanguage);
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
      if (!response.ok) throw new Error(payload?.error || "Não foi possível gerar o usuário.");
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

  function handleAvatarLibraryChoice(choice: AvatarLibraryChoice) {
    setError(null);

    if (choice.avatarValue.startsWith("data:image/") && choice.avatarValue.length > 1800) {
      setError("Imagem muito grande para salvar direto no cadastro. Use GIF por URL, emoji, ícone ou uma imagem menor.");
      return;
    }

    if (choice.avatarKind === "default") {
      setAvatarUrl("");
      setAvatarLabel("Sem foto");
      return;
    }

    setAvatarUrl(choice.avatarValue);
    setAvatarLabel(choice.avatarLabel || "Avatar do usuário");
  }

  function clearAvatarLibraryChoice() {
    setAvatarUrl("");
    setAvatarLabel("Sem foto");
  }

  function resetForm() {
    setName("");
    setLogin("");
    setEmail("");
    setPhone("");
    setJobTitle("");
    setLinkedin("");
    setAvatarUrl("");
    setAvatarLibraryOpen(false);
    setAvatarLabel("Sem foto");
    setTheme("system");
    setLanguage("pt-BR");
    setRole(normalizeEditableProfileRole(initialRole));
    setActive(true);
    if (isCompanyProfile && fixedCompany?.id) setLocalClientId(fixedCompany.id);
    else if (clientId) setLocalClientId(clientId);
    else if (availableClients.length === 1) setLocalClientId(availableClients[0].id);
    else setLocalClientId(null);
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
    setEmail(initialData?.email ?? "");
    setPhone(initialData?.phone ?? "");
    setJobTitle(initialData?.jobTitle ?? "");
    setLinkedin(initialData?.linkedin ?? "");
    setAvatarUrl(initialData?.avatarUrl ?? "");
    setAvatarLibraryOpen(false);
    setAvatarLabel(initialData?.avatarUrl ? "Avatar salvo" : "Sem foto");
    setTheme("system");
    setLanguage("pt-BR");
    setRole(normalizeEditableProfileRole(initialData?.role ?? initialRole));
    setActive(initialData?.active ?? true);
    if (initialData?.clientId) setLocalClientId(initialData.clientId);
    else if (isCompanyProfile && fixedCompany?.id) setLocalClientId(fixedCompany.id);
    else if (clientId) setLocalClientId(clientId);
    else if (availableClients.length === 1) setLocalClientId(availableClients[0].id);
    else setLocalClientId(null);
  }

  function handleCloseOrCancel() {
    if (mode === "view" && isEditing) {
      setIsEditing(false);
      return;
    }
    resetForm();
    onClose();
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

        const okMsg = "Usuario criado. Senha temporaria e confirmacao enviadas por e-mail.";
        setMessage(okMsg);
        toast.success(okMsg);
        resetForm();
        onClose();
        await onCreated?.();
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
        await onUpdated?.();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar usuário";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 px-3 py-4 backdrop-blur-sm" role="dialog" aria-modal="true" data-testid="create-user-modal">
      <div className="my-auto w-full max-w-5xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[28px] border border-slate-200 bg-white shadow-[0_34px_100px_rgba(15,23,42,0.34)]">
        <div className="flex items-start justify-between gap-4 bg-[linear-gradient(135deg,#011848_0%,#102f6e_58%,rgba(239,0,1,0.82)_160%)] px-6 py-5 text-white">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/60">Acesso e identidade</p>
            <h3 className="mt-1 text-2xl font-black tracking-tight text-white">{isViewMode ? "Visualizar usuário" : title}</h3>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-white/75">{isCreateMode ? "Cadastre o perfil. O sistema gera senha temporaria e envia a confirmacao de acesso para o e-mail informado." : subtitle}</p>
          </div>
          <button type="button" className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/20" onClick={handleCloseOrCancel}>
            Fechar
          </button>
        </div>

        {requiresClient && !localClientId && (
          <p className="mx-5 mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">Selecione uma empresa para criar usuario.</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 p-5" data-testid="create-user-form">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Dados principais</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
              Informe nome, e-mail e perfil. Login, senha temporaria e notificacao de acesso ficam sob responsabilidade do sistema.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {showCompanyField ? (
              shouldRenderFixedCompany ? (
                <div className="block text-sm sm:col-span-2" data-testid="create-user-company-fixed">
                  Empresa vinculada
                  <div className="mt-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950">
                    <p className="text-sm font-black">{selectedCompany?.name ?? "Empresa da instituição"}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-emerald-800">
                      Perfil Empresa cria usuários diretamente na própria instituição. A empresa fica fixa e não pode ser alterada neste fluxo.
                    </p>
                  </div>
                </div>
              ) : (
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
                    {availableClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )
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
            {isCreateMode ? (
              <label className="block text-sm">
                Acesso
                <div className="mt-1 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-950">
                  <p className="text-sm font-black">Senha temporaria automatica</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-sky-800">
                    O usuario recebera a senha temporaria e a confirmacao de acesso no e-mail cadastrado.
                  </p>
                </div>
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
            <div className="block text-sm sm:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <UserAvatar
                  src={avatarUrl.trim() || null}
                  name={avatarPreviewName}
                  size="lg"
                  editable={!isViewMode}
                  onEdit={() => setAvatarLibraryOpen(true)}
                  frameClassName="border-4 border-white bg-slate-100 shadow-[0_16px_34px_rgba(15,23,42,0.14)] ring-1 ring-slate-200"
                  fallbackClassName="text-xl font-black tracking-[0.18em] text-slate-600"
                  buttonClassName="bg-indigo-600 text-white hover:bg-indigo-700"
                  buttonLabel="Escolher foto, GIF ou emoji do usuário"
                />

                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Foto do perfil</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Use o mesmo padrão do Meu Perfil e das Solicitações: imagem, GIF, emoji, ícone ou URL.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAvatarLibraryOpen(true)}
                      disabled={isViewMode}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Escolher avatar
                    </button>

                    {avatarUrl.trim() && !isViewMode ? (
                      <button
                        type="button"
                        onClick={clearAvatarLibraryChoice}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-700 transition hover:bg-gray-100"
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>

                  <label className="block text-xs font-semibold text-gray-600">
                    URL / valor salvo
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none"
                      value={avatarUrl}
                      onChange={(e) => {
                        setAvatarUrl(e.target.value);
                        setAvatarLabel(e.target.value.trim() ? "Avatar informado manualmente" : "Sem foto");
                      }}
                      placeholder="https://exemplo.com/avatar.gif, emoji ou imagem"
                      disabled={isViewMode}
                    />
                  </label>

                  <p className="text-xs text-gray-500">
                    Selecionado: {avatarUrl.trim() ? avatarLabel : "Sem foto"}
                  </p>
                </div>
              </div>

              <AvatarLibraryDialog
                open={avatarLibraryOpen}
                onOpenChange={setAvatarLibraryOpen}
                value={avatarUrl}
                kind={avatarKind}
                onSelect={handleAvatarLibraryChoice}
              />
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
                {loading ? (isCreateMode ? "Criando e enviando..." : "Salvando...") : (isCreateMode ? submitLabel : "Salvar mudanças")}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

