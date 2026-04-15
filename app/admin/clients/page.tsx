"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateClientModal, type ClientFormValues } from "@/clients/components/CreateClientModal";
import { CreateUserModal } from "@/admin/users/components/CreateUserModal";
import { useAuth } from "@/context/AuthContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { fetchApi } from "@/lib/api";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";
import { extractMessageFromJson, extractRequestIdFromJson, formatMessageWithRequestId, readApiError, unwrapEnvelopeData } from "@/lib/apiEnvelope";
import { FiCheckCircle, FiExternalLink, FiEye, FiEyeOff, FiHome, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiUpload, FiUsers, FiX, FiXCircle, FiCloudLightning } from "react-icons/fi";
import { toast } from "react-hot-toast";
import Breadcrumb from "@/components/Breadcrumb";

type Client = {
  id: string;
  name: string;
  slug?: string | null;
  taxId?: string | null;
  address?: string | null;
  description?: string | null;
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  docsLink?: string | null;
  linkedinUrl?: string | null;
  notes?: string | null;
  integrationMode?: "qase" | "manual" | null;
  qaseProjectCode?: string | null;
  qaseProjectCodes?: string[] | null;
  qaseToken?: string | null;
  hasQaseToken?: boolean;
  jiraBaseUrl?: string | null;
  jiraEmail?: string | null;
  jiraApiToken?: string | null;
  notificationsFanoutEnabled?: boolean;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type LogoSource = {
  logoUrl?: string | null;
  slug?: string | null;
  website?: string | null;
  name?: string | null;
};

const FALLBACK_LOGOS: Record<string, string> = {
  griaule: "/images/griaule.png",
  "testing-company": "/images/testing-company.png",
};

function resolveLogoCandidates(source: LogoSource): string[] {
  const candidates: string[] = [];
  const addCandidate = (value: string | null | undefined) => {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed) return;
    if (!candidates.includes(trimmed)) candidates.push(trimmed);
  };

  const rawLogo = typeof source.logoUrl === "string" ? source.logoUrl.trim() : "";
  if (rawLogo) {
    if (/^(https?:|data:|blob:)/i.test(rawLogo)) {
      addCandidate(rawLogo);
    } else if (rawLogo.startsWith("//")) {
      addCandidate(`https:${rawLogo}`);
    } else if (rawLogo.startsWith("/")) {
      addCandidate(rawLogo);
    } else if (rawLogo.toLowerCase().startsWith("local:") && source.slug) {
      const relative = rawLogo.slice("local:".length);
      addCandidate(`/api/company-documents?slug=${encodeURIComponent(source.slug)}&path=${encodeURIComponent(relative)}`);
    } else if (rawLogo.includes(".")) {
      addCandidate(rawLogo.startsWith("images/") ? `/${rawLogo}` : `/images/${rawLogo}`);
    }
  }

  const slug = typeof source.slug === "string" ? source.slug.trim().toLowerCase() : "";
  if (slug && candidates.length === 0) {
    addCandidate(FALLBACK_LOGOS[slug]);
    addCandidate(`/images/${slug}.png`);
  }

  // Removido: não buscar logo externo (Clearbit) para evitar imagens externas
  // const website = typeof source.website === "string" ? source.website.trim() : "";
  // if (website) {
  //   try {
  //     const hostname = new URL(website).hostname;
  //     if (hostname) addCandidate(`https://logo.clearbit.com/${hostname}`);
  //   } catch {
  //     /* ignore invalid URL */
  //   }
  // }

  return candidates;
}

function getInitials(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}

function hasQaseTokenConfigured(client?: Partial<Client> | null) {
  if (!client) return false;
  if (typeof client.qaseToken === "string") return client.qaseToken.trim().length > 0;
  return client.hasQaseToken === true;
}

function mapClient(row: Record<string, unknown>): Client {
  const name =
    typeof row.name === "string"
      ? row.name
      : typeof row.company_name === "string"
        ? row.company_name
        : "";

  const id = typeof row.id === "string" ? row.id : String(row.id ?? "");

  const readNullableString = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
  const readBoolean = (value: unknown) => (typeof value === "boolean" ? value : false);
  const readProjectCodes = (value: unknown): string[] | null => {
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value as string[];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const arr = trimmed
        .split(/[\s,;|]+/g)
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean);
      return arr.length ? Array.from(new Set(arr)) : null;
    }
    return null;
  };

  return {
    id,
    name,
    slug: readNullableString(row.slug),
    taxId: readNullableString(row.tax_id),
    address: readNullableString(row.address),
    description: readNullableString(row.description),
    website: readNullableString(row.website),
    phone: readNullableString(row.phone),
    logoUrl: readNullableString(row.logo_url),
    docsLink: readNullableString(row.docs_link),
    linkedinUrl: readNullableString(row.linkedin_url) ?? readNullableString(row.docs_link),
    notes: readNullableString(row.notes),
    integrationMode: readNullableString(row.integration_mode) as "qase" | "manual" | null,
    qaseProjectCode: readNullableString(row.qase_project_code),
    qaseProjectCodes: readProjectCodes(row.qase_project_codes),
    qaseToken: null,
    hasQaseToken: !!readNullableString(row.qase_token),
    jiraBaseUrl: readNullableString(row.jira_base_url),
    jiraEmail: readNullableString(row.jira_email),
    jiraApiToken: null,
    notificationsFanoutEnabled: typeof row.notifications_fanout_enabled === "boolean" ? row.notifications_fanout_enabled : true,
    // parse new integrations array when present
    ...(() => {
      const integrations = (row as any).integrations;
      if (!Array.isArray(integrations)) return {};
      const out: Partial<Client> = {};
      for (const it of integrations) {
        if (!it || typeof it !== "object") continue;
        const type = String(it.type || "").toUpperCase();
        const cfg = it.config ?? {};
        if (type === "QASE") {
          if (typeof cfg.token === "string" && cfg.token.trim()) {
            out.hasQaseToken = true;
            out.qaseToken = cfg.token;
          }
          if (Array.isArray(cfg.projects) && cfg.projects.length) {
            out.qaseProjectCodes = Array.from(new Set([...(out.qaseProjectCodes ?? []), ...cfg.projects.map((p: any) => (typeof p === "string" ? p.trim().toUpperCase() : String(p).trim().toUpperCase()))]));
            if (!out.qaseProjectCode && out.qaseProjectCodes && out.qaseProjectCodes.length) out.qaseProjectCode = out.qaseProjectCodes[0];
          }
        }
        if (type === "JIRA") {
          if (typeof cfg.baseUrl === "string" && cfg.baseUrl.trim()) out.jiraBaseUrl = cfg.baseUrl;
          if (typeof cfg.email === "string" && cfg.email.trim()) out.jiraEmail = cfg.email;
          if (typeof cfg.apiToken === "string" && cfg.apiToken.trim()) out.jiraApiToken = cfg.apiToken;
        }
      }
      return out;
    })(),
    active: readBoolean(row.active),
    createdAt: readNullableString(row.created_at),
    updatedAt: readNullableString(row.updated_at),
  };
}

function AdminClientsPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { user } = useAuthUser();
  const isGlobalAdmin = !!user?.isGlobalAdmin || (user as { is_global_admin?: boolean } | null)?.is_global_admin === true;

  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Client>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  // Qase integration UI states
  const [qaseProjects, setQaseProjects] = useState<Array<{ code: string; title: string; status?: "valid" | "invalid" | "unknown" }>>([]);
  const [loadingQaseProjects, setLoadingQaseProjects] = useState(false);
  const [qaseProjectsError, setQaseProjectsError] = useState<string | null>(null);
  const [searchProjects, setSearchProjects] = useState("");
  const [onlyValid, setOnlyValid] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const projectsRef = useRef<HTMLDivElement | null>(null);
  const [validatingProjects, setValidatingProjects] = useState(false);
  const [activeTab, setActiveTab] = useState<"visão" | "pessoas">("visão");
  const [openCreate, setOpenCreate] = useState(false);
  const [companyAction, setCompanyAction] = useState<null | "activate" | "deactivate" | "delete">(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  async function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (logoInputRef.current) logoInputRef.current.value = "";
    if (!file || !selectedId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Envie uma imagem válida (PNG, JPG, SVG…)");
      return;
    }
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/clients/${selectedId}/logo`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((payload as { error?: string }).error || "Não foi possível enviar o logo");
        return;
      }
      const logoUrl = (payload as { logoUrl?: string }).logoUrl ?? "";
      setForm((f) => ({ ...f, logoUrl }));
      setItems((prev) => prev.map((c) => (c.id === selectedId ? { ...c, logoUrl } : c)));
      await refreshUser();
      toast.success("Logo atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar logo");
    } finally {
      setLogoUploading(false);
    }
  }

  const selected = useMemo(() => items.find((c) => c.id === selectedId) ?? null, [items, selectedId]);
  const currentActive = form.active ?? selected?.active ?? false;
  const currentName = (form.name && form.name.trim()) || selected?.name || "Empresa";
  const currentSlug = (form.slug ?? selected?.slug) || null;
  const currentTaxId = form.taxId ?? selected?.taxId ?? null;
  const currentAddress = form.address ?? selected?.address ?? null;
  const currentPhone = form.phone ?? selected?.phone ?? null;
  const currentWebsite = form.website ?? selected?.website ?? null;
  const currentDocsLink = form.docsLink ?? selected?.docsLink ?? null;
  const currentLinkedin = form.linkedinUrl ?? selected?.linkedinUrl ?? currentDocsLink ?? null;
  const currentDescription = form.description ?? selected?.description ?? null;
  const currentNotes = form.notes ?? selected?.notes ?? null;
  const currentQaseProject = form.qaseProjectCode ?? selected?.qaseProjectCode ?? null;
  const currentNotificationsFanoutEnabled =
    typeof form.notificationsFanoutEnabled === "boolean"
      ? form.notificationsFanoutEnabled
      : typeof selected?.notificationsFanoutEnabled === "boolean"
        ? selected.notificationsFanoutEnabled
        : true;
  const currentQaseProjects =
    ((form.qaseProjectCodes !== undefined ? form.qaseProjectCodes : selected?.qaseProjectCodes) ?? null)?.join(", ") ?? null;
  const currentHasQaseToken = hasQaseTokenConfigured(form) || hasQaseTokenConfigured(selected);
  const hasQaseIntegration = currentHasQaseToken;
  const hasJiraIntegration = Boolean(form.jiraBaseUrl ?? selected?.jiraBaseUrl ?? form.jiraApiToken ?? selected?.jiraApiToken);
  const integrationLabels = [] as string[];
  if (hasQaseIntegration) integrationLabels.push("Qase");
  if (hasJiraIntegration) integrationLabels.push("Jira");
  const currentIntegrationMode = integrationLabels.length ? integrationLabels.join(", ") : "Manual";
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((client) =>
      [client.name, client.slug, client.taxId, client.website, client.phone, client.address]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [items, search]);
  const activeCompaniesCount = useMemo(() => items.filter((item) => item.active).length, [items]);
  const inactiveCompaniesCount = useMemo(() => Math.max(0, items.length - activeCompaniesCount), [items.length, activeCompaniesCount]);
  const qaseCompaniesCount = useMemo(
    () => items.filter((item) => item.hasQaseToken).length,
    [items],
  );
  const resetForm = () => {
    if (selected) setForm(selected);
  };

  function requestToggleCompanyStatus() {
    if (!selectedId || saving) return;
    setCompanyAction(currentActive ? "deactivate" : "activate");
  }

  async function toggleCompanyStatus() {
    if (!selectedId || saving) return;
    const nextActive = !currentActive;

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetchApi(`/api/clients/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active: nextActive,
          status: nextActive ? "active" : "inactive",
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = extractMessageFromJson(err) || "Não foi possível atualizar o status da empresa";
        setMessage(msg);
        toast.error(msg);
        return;
      }

      const raw = await res.json().catch(() => null);
      const updated = unwrapEnvelopeData<Record<string, unknown>>(raw) ?? (raw as Record<string, unknown> | null);
      if (updated) {
        const next = mapClient(updated);
        setItems((prev) => prev.map((c) => (c.id === selectedId ? next : c)));
        setForm(next);
      }

      await refreshUser();
      toast.success(nextActive ? "Empresa ativada" : "Empresa inativada");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar status";
      setMessage(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
      setCompanyAction(null);
    }
  }

  async function deleteCompany() {
    if (!selectedId || saving) return;

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetchApi(`/api/clients/${selectedId}`, {
        method: "DELETE",
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = extractMessageFromJson(err) || "Não foi possível excluir a empresa";
        setMessage(msg);
        toast.error(msg);
        return;
      }

      setItems((prev) => prev.filter((company) => company.id !== selectedId));
      await refreshUser();
      toast.success("Empresa excluida");
      closeModal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir empresa";
      setMessage(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
      setCompanyAction(null);
    }
  }

  const handleUnauthorized = useCallback(() => {
    const msg = "Sessão expirada. Faça login novamente.";
    setMessage(msg);
    toast.error(msg);
    router.replace("/login");
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetchApi("/api/clients");
      if (res.status === 401) {
        handleUnauthorized();
        setItems([]);
        return;
      }
      if (res.status === 403) {
        setMessage("Acesso negado: use uma conta de admin global.");
        toast.error("Acesso negado: use uma conta de admin global.");
        setItems([]);
        return;
      }
      const raw = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = extractMessageFromJson(raw) || "Erro ao carregar empresas";
        const requestId = extractRequestIdFromJson(raw) || res.headers.get("x-request-id") || null;
        const formatted = formatMessageWithRequestId(msg, requestId);
        setMessage(formatted);
        toast.error(formatted);
        setItems([]);
        return;
      }

      const data = unwrapEnvelopeData<{ items?: unknown[] }>(raw) ?? null;
      const items = Array.isArray(data?.items) ? data!.items : [];
      setItems(items.map((row) => mapClient((row ?? {}) as Record<string, unknown>)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar clientes";
      setMessage(msg);
      toast.error(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);

  async function openModal(id: string) {
    setSelectedId(id);
    setIsEditing(false);
    setMessage(null);
    try {
      const res = await fetchApi(`/api/clients/${id}`);
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) {
        const fallback = items.find((c) => c.id === id);
        if (fallback) {
          setForm(fallback);
          return;
        }
        setMessage("Não foi possível carregar o cliente selecionado");
        return;
      }
      const raw = await res.json().catch(() => null);
      const data = unwrapEnvelopeData<Record<string, unknown>>(raw) ?? (raw as Record<string, unknown> | null);
      setForm(mapClient((data ?? {}) as Record<string, unknown>));
    } catch (err) {
      const fallback = items.find((c) => c.id === id);
      if (fallback) {
        setForm(fallback);
        return;
      }
      const msg = err instanceof Error ? err.message : "Erro ao abrir o cliente";
      setMessage(msg);
    }
  }

  function closeModal() {
    setSelectedId(null);
    setForm({});
    setIsEditing(false);
    setActiveTab("visão");
    setCompanyAction(null);
  }

  async function save() {
    if (!selectedId) return;
    setSaving(true);
    setMessage(null);
    try {
      const normalizedQaseProjectCodes = Array.isArray(form.qaseProjectCodes)
        ? form.qaseProjectCodes.map((c) => (typeof c === "string" ? c.trim().toUpperCase() : String(c).trim().toUpperCase())).filter(Boolean)
        : typeof form.qaseProjectCode === "string"
        ? [form.qaseProjectCode.trim().toUpperCase()]
        : [];

      const payload = {
        name: form.name || undefined,
        tax_id: form.taxId || undefined,
        address: form.address || undefined,
        description: form.description || undefined,
        phone: form.phone || undefined,
        website: form.website || undefined,
        logo_url: form.logoUrl || undefined,
        docs_link: form.docsLink || undefined,
        linkedin_url: form.linkedinUrl || undefined,
        notes: form.notes || undefined,
        active: typeof form.active === "boolean" ? form.active : undefined,
        integration_mode: form.integrationMode || undefined,
        // always include the explicit array só backend can detect an intentional clear vs omission
        qase_project_codes: normalizedQaseProjectCodes,
        qase_project_code: normalizedQaseProjectCodes.length ? normalizedQaseProjectCodes[0] : null,
        qase_token: form.qaseToken && form.qaseToken.trim() ? form.qaseToken : undefined,
        notifications_fanout_enabled:
          typeof form.notificationsFanoutEnabled === "boolean" ? form.notificationsFanoutEnabled : undefined,
        jira_base_url: form.jiraBaseUrl || undefined,
        jira_email: form.jiraEmail || undefined,
        jira_api_token: form.jiraApiToken && form.jiraApiToken.trim() ? form.jiraApiToken : undefined,
      };
      const res = await fetchApi(`/api/clients/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = extractMessageFromJson(err) || "Erro ao salvar empresa";
        const requestId = extractRequestIdFromJson(err) || res.headers.get("x-request-id") || null;
        const formatted = formatMessageWithRequestId(msg, requestId);
        setMessage(formatted);
        toast.error(formatted);
        return;
      }
      const raw = await res.json().catch(() => null);
      const updated = unwrapEnvelopeData<Record<string, unknown>>(raw) ?? (raw as Record<string, unknown> | null);
      if (updated) {
        const next = mapClient(updated);
        setItems((prev) => prev.map((c) => (c.id === selectedId ? next : c)));
        setForm(next);
      }
      setIsEditing(false);
      await refreshUser();
      toast.success("Empresa atualizada");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar cliente";
      setMessage(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateClient(data: ClientFormValues) {
    try {
      const normalizedCodes = Array.isArray(data.qaseProjectCodes)
        ? data.qaseProjectCodes.map((c) => (typeof c === "string" ? c.trim().toUpperCase() : String(c).trim().toUpperCase())).filter(Boolean)
        : typeof data.qaseProjectCode === "string"
        ? [data.qaseProjectCode.trim().toUpperCase()]
        : [];
      const legacyProjectCode = data.integrationMode === "qase" ? (normalizedCodes.length ? normalizedCodes[0] : null) : undefined;
      const address = [data.zip, data.address ?? data.description].filter(Boolean).join(" | ");
      const payload = {
        name: data.name,
        company_name: data.name,
        tax_id: data.taxId,
        address: address || undefined,
        phone: data.phone,
        website: data.website,
        logo_url: data.logoUrl,
        linkedin_url: data.linkedin,
        notes: data.notes,
        active: data.active,
        description: data.description,
        integration_mode: data.integrationMode,
        qase_token: data.qaseToken || undefined,
        notifications_fanout_enabled: true,
        // send explicit array (can be empty) and derive legacy code from it
        qase_project_codes: normalizedCodes,
        qase_project_code: legacyProjectCode ?? null,
        jira_base_url: data.jiraBaseUrl,
        jira_email: data.jiraEmail,
        jira_api_token: data.jiraApiToken,
        // new integrations array for explicit multi-integration support
        integrations: (() => {
          const items: any[] = [];
          if (data.qaseToken || (Array.isArray(data.qaseProjectCodes) && data.qaseProjectCodes.length)) {
            items.push({ type: "QASE", config: { token: data.qaseToken || null, projects: data.qaseProjectCodes || [] } });
          }
          if (data.jiraBaseUrl || data.jiraApiToken || data.jiraEmail) {
            items.push({ type: "JIRA", config: { baseUrl: data.jiraBaseUrl || null, email: data.jiraEmail || null, apiToken: data.jiraApiToken || null } });
          }
          return items.length ? items : undefined;
        })(),
      };
      const res = await fetchApi("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        handleUnauthorized();
        return null;
      }
      if (!res.ok) {
        const err = await readApiError(res, "Erro ao criar cliente");
        setMessage(err.message);
        toast.error(err.displayMessage);
        return null;
      }
      const created = await res.json().catch(() => null);
      if (created) {
        setItems((prev) => [mapClient(created), ...prev]);
        await refreshUser();
        if (data.integrationMode === "manual") {
          setMessage(
            "Empresa criada sem integração. Você pode configurar Qase depois (token + project code) ou seguir em modo manual.",
          );
        }
        // Show richer feedback when Qase integration data was provided
        try {
          const messages: string[] = [];
          if (created.qase_token) messages.push("Token salvo");
          const providedCodes = Array.isArray(created.qase_project_codes) ? created.qase_project_codes : undefined;
          if (providedCodes && providedCodes.length) messages.push(`Projetos vinculados: ${providedCodes.length}`);

          // fetch created applications to show how many were generated
          if (created.slug) {
            try {
              const appsRes = await fetchApi(`/api/applications?companySlug=${encodeURIComponent(created.slug)}`);
              if (appsRes.ok) {
                const appsJson = await appsRes.json().catch(() => null);
                const apps = Array.isArray(appsJson?.items) ? appsJson.items : [];
                if (apps.length) messages.push(`Aplicações geradas: ${apps.length}`);
              }
            } catch {
              // ignore applications fetch errors
            }
          }

          if (messages.length) {
            toast.success(messages.join(" — "));
          } else {
            toast.success("Empresa cadastrada");
          }
        } catch (err) {
          toast.success("Empresa cadastrada");
        }
        return created;
      }
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar cliente";
      setMessage(msg);
      toast.error(msg);
      return null;
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-(--page-bg,#f3f6fb) text-(--page-text,#0b1a3c)">
      <div className="mx-auto w-full max-w-none px-2 py-4 sm:px-4 lg:px-6 xl:px-8 2xl:px-10 space-y-4">
        <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Empresas" }]} />

        <section className="overflow-hidden rounded-[30px] border border-white/12 bg-[linear-gradient(135deg,#011848_0%,#082457_38%,#4b0f2f_72%,#ef0001_100%)] px-5 py-5 text-white shadow-[0_22px_60px_rgba(15,23,42,0.15)] sm:px-6 lg:px-7">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Base de empresas</p>
                <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">Empresas da plataforma</h1>
                <p className="max-w-2xl text-sm leading-6 text-white/82">
                  Consulte clientes, abra o detalhe da empresa e acompanhe integrações e usuários vinculados.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:max-w-130 lg:justify-end">
                {isGlobalAdmin && (
                  <button
                    type="button"
                    onClick={() => setOpenCreate(true)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/18 bg-white/8 px-3.5 text-sm font-semibold text-white transition hover:bg-white/12"
                  >
                    <FiPlus className="h-4 w-4" /> Cadastrar empresa
                  </button>
                )}
                {isGlobalAdmin && (
                  <a
                    href="/admin/users"
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/18 bg-white/8 px-3.5 text-sm font-semibold text-white transition hover:bg-white/12"
                  >
                    <FiUsers className="h-4 w-4" /> Gerenciar usuários
                  </a>
                )}
                <button
                  type="button"
                  onClick={load}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/18 bg-white/8 px-3.5 text-sm font-semibold text-white transition hover:bg-white/12 disabled:opacity-60"
                  disabled={loading}
                >
                  <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
                </button>
              </div>
            </div>

            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <div className="rounded-[18px] border border-white/14 bg-white/10 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">Empresas</div>
                    <div className="mt-2 text-[28px] font-extrabold leading-none text-white">{items.length}</div>
                    <div className="mt-1 text-sm text-white/76">cadastradas</div>
                  </div>
                  <FiHome className="mt-1 h-4 w-4 text-white/72" />
                </div>
              </div>
              <div className="rounded-[18px] border border-white/14 bg-white/10 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">Ativas</div>
                    <div className="mt-2 text-[28px] font-extrabold leading-none text-white">{activeCompaniesCount}</div>
                    <div className="mt-1 text-sm text-white/76">em operação</div>
                  </div>
                  <FiCheckCircle className="mt-1 h-4 w-4 text-white/72" />
                </div>
              </div>
              <div className="rounded-[18px] border border-white/14 bg-white/10 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">Inativas</div>
                    <div className="mt-2 text-[28px] font-extrabold leading-none text-white">{inactiveCompaniesCount}</div>
                    <div className="mt-1 text-sm text-white/76">fora da operação</div>
                  </div>
                  <FiXCircle className="mt-1 h-4 w-4 text-white/72" />
                </div>
              </div>
              <div className="rounded-[18px] border border-white/14 bg-white/10 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">Qase</div>
                    <div className="mt-2 text-[28px] font-extrabold leading-none text-white">{qaseCompaniesCount}</div>
                    <div className="mt-1 text-sm text-white/76">com token</div>
                  </div>
                  <FiUsers className="mt-1 h-4 w-4 text-white/72" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {message && (
          <p role="status" aria-live="polite" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {message}
          </p>
        )}

        <section className="rounded-[28px] border border-(--tc-border,#d7deea) bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-5 xl:p-6 min-h-[calc(100vh-210px)]">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-(--tc-text-muted,#6b7280)">Carteira de empresas</p>
              <h2 className="mt-2 text-2xl font-bold text-(--tc-text-primary,#0b1a3c)">Lista de empresas</h2>
              <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Abra uma empresa para ver dados, integrações e usuários.</p>
            </div>
            <label className="flex w-full items-center gap-3 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) px-4 py-3 text-sm text-(--tc-text-secondary,#4b5563)">
              <FiSearch className="h-4 w-4 text-(--tc-text-muted,#6b7280)" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, slug, CNPJ, site ou telefone"
                className="w-full bg-transparent outline-none placeholder:text-(--tc-text-muted,#94a3b8)"
              />
            </label>
          </div>

          {loading ? (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) p-5">
                  <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
                  <div className="mt-4 flex items-start gap-3">
                    <div className="h-12 w-12 animate-pulse rounded-xl bg-slate-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-2/3 animate-pulse rounded-full bg-slate-200" />
                      <div className="h-4 w-1/2 animate-pulse rounded-full bg-slate-200" />
                      <div className="h-4 w-full animate-pulse rounded-full bg-slate-200" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filteredItems.map((client) => (
            <button
              type="button"
              key={client.id}
              onClick={() => openModal(client.id)}
              className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-(--tc-border,#d7deea) bg-white p-4 text-left transition hover:border-(--tc-accent,#ef0001)/35 hover:shadow-[0_14px_32px_rgba(15,23,42,0.06)] focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/20"
            >
                <div className="flex h-full flex-col gap-4">
                  <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc)">
                  <CompanyLogo
                    logoUrl={client.logoUrl}
                    slug={client.slug}
                    website={client.website}
                    name={client.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-[15px] font-bold leading-5 text-slate-900" title={client.name}>
                        {client.name}
                      </div>
                      <div className="mt-1 truncate text-sm text-slate-500">
                        {client.slug ? `@${client.slug}` : "Sem slug"}
                      </div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        client.active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {client.active ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-2.5 py-2">
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Integração</span>
                      <span className="truncate text-sm font-semibold text-slate-900">{(() => {
                        const labels: string[] = [];
                        if (client.hasQaseToken) labels.push("Qase");
                        if (client.jiraBaseUrl || client.jiraApiToken || client.jiraEmail) labels.push("Jira");
                        return labels.length ? labels.join(", ") : "Manual";
                      })()}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-2.5 py-2">
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">CNPJ</span>
                      <span className="truncate text-sm font-medium text-slate-700" title={client.taxId || "Não informado"}>
                        {client.taxId || "Não informado"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-2.5 py-2">
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Criado</span>
                      <span className="text-sm font-medium text-slate-700">
                        {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : "Sem data"}
                      </span>
                    </div>
                    {client.website ? (
                      <div className="truncate text-xs text-slate-500" title={client.website}>
                        {client.website}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
                  <div className="mt-auto flex items-center justify-end border-t border-(--tc-border,#eef2f7) pt-3 text-xs">
                    <span className="font-semibold text-(--tc-accent,#ef0001)">Abrir detalhes</span>
                  </div>
                </div>
            </button>
          ))}
          {filteredItems.length === 0 && (
            <div className="col-span-full text-sm text-(--tc-text-muted,#6b7280)">
              {isGlobalAdmin ? (
                <div className="mt-2 rounded-3xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-alt,#f8fafc) p-8 text-center">
                  <p className="text-xl font-bold text-(--tc-text-primary,#0b1a3c)">
                    {items.length === 0 ? "Nenhuma empresa cadastrada" : "Nenhuma empresa encontrada"}
                  </p>
                  <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
                    {items.length === 0
                      ? "Cadastre a primeira empresa para iniciar a base da plataforma."
                      : "Ajuste a busca para encontrar outra empresa."}
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpenCreate(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#071e53_0%,#ef0001_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(239,0,1,0.18)] transition hover:opacity-95"
                  >
                    <FiPlus className="h-4 w-4" /> Cadastrar empresa
                  </button>
                </div>
              ) : (
                <p>Nenhuma empresa encontrada.</p>
              )}
            </div>
          )}
        </div>
          )}
        </section>

      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-2 py-4 sm:px-4 sm:py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-modal-title"
            className="flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) shadow-2xl my-auto max-h-[calc(100vh-48px)] sm:max-h-[calc(100vh-72px)]"
          >
            {/* Header */}
            <div className="relative shrink-0 overflow-hidden border-b border-white/10 bg-linear-to-r from-[#011848] via-[#0b1e3c] to-[#7a1026] p-6 text-white">
              <div className="pointer-events-none absolute -left-10 top-0 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
              <div className="pointer-events-none absolute right-0 top-6 h-32 w-32 rounded-full bg-[#ef0001]/35 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-[#3b82f6]/20 blur-3xl" />
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl logo-background border border-white/20 flex items-center justify-center overflow-hidden shadow-inner">
                      <CompanyLogo
                        logoUrl={(form.logoUrl ?? selected.logoUrl) ?? null}
                        slug={(form.slug ?? selected.slug) ?? null}
                        website={(form.website ?? selected.website) ?? null}
                        name={currentName}
                        className="logo-image"
                      />
                    </div>
                    <div className="min-w-45">
                      <h2
                        id="client-modal-title"
                        className="text-2xl font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] leading-tight"
                      >
                        {currentName}
                      </h2>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {currentActive ? (
                      <button
                        type="button"
                        aria-pressed="true"
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-400 bg-emerald-500 px-3 py-1 text-xs text-white transition"
                        onClick={() => {
                          if (isEditing) {
                            setForm((f) => ({ ...f, active: false }));
                            return;
                          }
                          requestToggleCompanyStatus();
                        }}
                        title={isEditing ? "Alterar status" : "Ativar ou inativar empresa"}
                      >
                        <FiCheckCircle size={12} />
                        Ativa
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-pressed="false"
                        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-200 px-3 py-1 text-xs text-amber-800 transition"
                        onClick={() => {
                          if (isEditing) {
                            setForm((f) => ({ ...f, active: true }));
                            return;
                          }
                          requestToggleCompanyStatus();
                        }}
                        title={isEditing ? "Alterar status" : "Ativar ou inativar empresa"}
                      >
                        <FiXCircle size={12} />
                        Inativa
                      </button>
                    )}
                    {currentTaxId ? <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90">CNPJ: {currentTaxId}</span> : null}
                    <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90">Integração: {currentIntegrationMode}</span>
                    <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90">
                      Notificações: {currentNotificationsFanoutEnabled ? "Fan-out ligado" : "Fan-out desligado"}
                    </span>
                    {currentWebsite ? (
                      <HeaderLinkTag href={currentWebsite} label="Website" external />
                    ) : null}
                    {currentLinkedin ? (
                      <HeaderLinkTag href={currentLinkedin} label="LinkedIn" external />
                    ) : null}
                    {currentSlug ? (
                      <HeaderLinkTag href={`/empresas/${currentSlug}/documentos`} label="Documentos" />
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton
                    title="Abrir perfil da empresa"
                    onClick={() => {
                      const slug = form.slug || selected.slug || null;
                      if (!slug) {
                        toast.error("Empresa sem slug para abrir o perfil.");
                        return;
                      }
                      router.push(`/empresas/${slug}/home`);
                    }}
                    disabled={!currentSlug}
                  >
                    <FiExternalLink size={16} />
                  </IconButton>
                  <IconButton
                    title="Fechar" onClick={closeModal}>
                    <FiX size={16} />
                  </IconButton>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-b border-(--tc-border) bg-(--tc-surface,#ffffff) px-6 py-3 md:px-7">
            {/* Tabs */}
            <div role="tablist" aria-label="Detalhes da empresa" className="flex items-center gap-3">
              {activeTab === "visão" ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "visão"}
                  tabIndex={0}
                  onClick={() => setActiveTab("visão")}
                  className="border-b-2 border-(--tc-accent) px-3 py-2 text-sm font-semibold text-(--tc-text-primary) transition"
                  data-testid="tab-button"
                >
                  Visão geral
                </button>
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={false}
                  tabIndex={-1}
                  onClick={() => setActiveTab("visão")}
                  className="border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-(--tc-text-muted) transition hover:text-(--tc-text-primary)"
                  data-testid="tab-button"
                >
                  Visão geral
                </button>
              )}
              {activeTab === "pessoas" ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "pessoas"}
                  tabIndex={0}
                  onClick={() => setActiveTab("pessoas")}
                  className="border-b-2 border-(--tc-accent) px-3 py-2 text-sm font-semibold text-(--tc-text-primary) transition"
                  data-testid="tab-button"
                >
                  Usuários
                </button>
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={false}
                  tabIndex={-1}
                  onClick={() => setActiveTab("pessoas")}
                  className="border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-(--tc-text-muted) transition hover:text-(--tc-text-primary)"
                  data-testid="tab-button"
                >
                  Usuários
                </button>
              )}
            </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 md:px-7 [scrollbar-gutter:stable]">

            {/* Tab content */}
            {activeTab === "visão" && (
              <div className="space-y-4">
                <SectionCard
                  eyebrow="Visão geral"
                  title="Dados principais"
                  description="Dados essenciais da empresa em uma estrutura única de formulario."
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <DetailField
                      label="Nome da empresa"
                      value={isEditing ? form.name ?? "" : currentName}
                      editable={isEditing}
                      onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                    />
                    <DetailField
                      label="CNPJ"
                      value={isEditing ? form.taxId ?? "" : currentTaxId ?? ""}
                      editable={isEditing}
                      onChange={(v) => setForm((f) => ({ ...f, taxId: v }))}
                    />
                    <DetailField
                      label="Endereço"
                      value={isEditing ? form.address ?? "" : currentAddress ?? ""}
                      editable={isEditing}
                      onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                    />
                    <DetailField
                      label="Telefone"
                      value={isEditing ? form.phone ?? "" : currentPhone ?? ""}
                      editable={isEditing}
                      onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                    />
                    <DetailField
                      label="Website"
                      value={isEditing ? form.website ?? "" : currentWebsite ?? ""}
                      editable={isEditing}
                      onChange={(v) => setForm((f) => ({ ...f, website: v }))}
                    />
                    <DetailField
                      label="LinkedIn"
                      value={isEditing ? form.linkedinUrl ?? currentLinkedin ?? "" : currentLinkedin ?? ""}
                      editable={isEditing}
                      onChange={(v) => setForm((f) => ({ ...f, linkedinUrl: v }))}
                    />
                    <div className="block text-sm text-(--tc-text-primary)">
                      <span className="mb-1 block">Logo da empresa (URL ou upload)</span>
                      <div className="flex items-center gap-2">
                        <input
                          className={`min-w-0 flex-1 rounded-lg border border-(--tc-border) px-3 py-2 text-sm text-(--tc-text-primary) ${
                            isEditing
                              ? "bg-(--tc-surface) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/30 focus:border-(--tc-accent)"
                              : "bg-(--tc-surface-2) text-(--tc-text-secondary)"
                          }`}
                          value={isEditing ? form.logoUrl ?? "" : (form.logoUrl ?? selected.logoUrl ?? "")}
                          readOnly={!isEditing}
                          onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                          placeholder="https://example.com/logo.png"
                          autoComplete="off"
                          spellCheck={false}
                        />
                        {isEditing && (
                          <>
                            <input
                              ref={logoInputRef}
                              type="file"
                              accept="image/*"
                              aria-label="Enviar logo da empresa"
                              title="Enviar logo da empresa"
                              className="sr-only"
                              onChange={handleLogoFileChange}
                            />
                            <button
                              type="button"
                              title="Enviar logo da empresa"
                              aria-label="Enviar logo da empresa"
                              disabled={logoUploading}
                              onClick={() => logoInputRef.current?.click()}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-(--tc-border) bg-(--tc-surface) px-3 py-2 text-sm font-medium text-(--tc-text-primary) transition hover:bg-(--tc-surface-2) disabled:opacity-60"
                            >
                              <FiUpload className="h-4 w-4" />
                              {logoUploading ? "Enviando…" : "Upload"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2 rounded-xl border border-(--tc-border) bg-(--tc-surface-2) p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-(--tc-text-primary)">Fan-out de notificações</p>
                          <p className="text-xs text-(--tc-text-muted)">
                            Quando ativo, mudanças no contexto da empresa notificam também usuários vinculados (empresa e TC vinculado).
                          </p>
                        </div>
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, notificationsFanoutEnabled: !currentNotificationsFanoutEnabled }))}
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition ${
                              currentNotificationsFanoutEnabled
                                ? "border border-emerald-300 bg-emerald-100 text-emerald-800"
                                : "border border-amber-300 bg-amber-100 text-amber-800"
                            }`}
                          >
                            {currentNotificationsFanoutEnabled ? "Ligado" : "Desligado"}
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                              currentNotificationsFanoutEnabled
                                ? "border border-emerald-300 bg-emerald-100 text-emerald-800"
                                : "border border-amber-300 bg-amber-100 text-amber-800"
                            }`}
                          >
                            {currentNotificationsFanoutEnabled ? "Ligado" : "Desligado"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  eyebrow="Conexão"
                  title="Integração com Qase"
                  description="A empresa guarda o contexto base da integração para projetos e aplicações."
                >
                  <div className="space-y-3">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                          <label className="block text-sm md:col-span-2">
                            Token da Qase
                            <div className="relative mt-2">
                                <input
                                type="password"
                                value={form.qaseToken ?? ""}
                                onChange={(e) => setForm((f) => ({ ...f, qaseToken: e.target.value }))}
                                placeholder="Deixe em branco para manter"
                                className="mt-1 h-10 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#fff) px-3 text-sm"
                              />
                            </div>
                          </label>

                          <button
                            type="button"
                            onClick={async () => {
                              const token = (form.qaseToken ?? "").toString().trim();
                              if (!token) {
                                setQaseProjectsError("Informe o token da Qase antes de buscar os projetos.");
                                return;
                              }
                              setLoadingQaseProjects(true);
                              setQaseProjectsError(null);
                              try {
                                const res = await fetchApi("/api/admin/qase/projects", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ token, all: true }),
                                });
                                const data = await res.json().catch(() => null);
                                if (!res.ok) throw new Error((data && (data.error || data.message)) || "Erro ao buscar projetos");
                                const items = Array.isArray(data?.items) ? data.items.map((it: any) => ({ code: String(it.code).trim().toUpperCase(), title: String(it.title || it.code).trim(), status: "valid" as const })) : [];
                                setQaseProjects(items);
                                const existing = Array.isArray(form.qaseProjectCodes) ? form.qaseProjectCodes.map((c) => String(c).trim().toUpperCase()) : [];
                                const preserved = existing.filter((c) => items.some((i: any) => i.code === c));
                                setForm((f) => ({ ...f, qaseProjectCodes: preserved.length ? preserved : items.length === 1 ? [items[0].code] : existing }));
                                setForm((f) => ({ ...f, qaseProjectCode: (f.qaseProjectCode ?? items[0]?.code ?? f.qaseProjectCode) }));
                              } catch (err) {
                                const msg = err instanceof Error ? err.message : "Erro ao buscar projetos";
                                setQaseProjects([]);
                                setQaseProjectsError(msg);
                              } finally {
                                setLoadingQaseProjects(false);
                              }
                            }}
                            className="inline-flex items-center gap-2 h-10 rounded-lg bg-linear-to-b from-(--tc-accent,#ff4b4b) to-(--tc-accent-dark,#c30000) px-4 text-sm font-semibold text-white shadow-lg transition duration-150 hover:opacity-95 md:self-end"
                          >
                            {loadingQaseProjects ? "Buscando..." : "Buscar projetos"}
                          </button>

                        </div>

                        {qaseProjectsError ? <div className="text-xs text-amber-800">{qaseProjectsError}</div> : null}

                        {qaseProjects.length > 0 ? (
                          <div className="space-y-3 rounded-xl border border-(--tc-border) bg-(--tc-surface) p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold">Projetos encontrados</p>
                                <p className="text-xs text-(--tc-text-muted)">Selecione os projetos que deseja vincular — cada projeto vira uma aplicação independente.</p>
                              </div>
                              <div className="text-sm text-(--tc-text-muted)">{Math.min(displayLimit, qaseProjects.filter((p) => {
                                const q = searchProjects.trim().toLowerCase();
                                if (onlyValid && p.status !== "valid") return false;
                                if (!q) return true;
                                return p.code.toLowerCase().includes(q) || p.title.toLowerCase().includes(q);
                              }).length)} carregados • {(Array.isArray(form.qaseProjectCodes) ? form.qaseProjectCodes.length : 0)} selecionado{(Array.isArray(form.qaseProjectCodes) && form.qaseProjectCodes.length !== 1) ? "s" : ""}</div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="relative flex-1">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-(--tc-text-muted)" />
                                <input value={searchProjects} onChange={(e) => setSearchProjects(e.target.value)} placeholder="Filtrar projetos" className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) pl-10 pr-3 py-2 text-sm text-(--tc-text)" />
                              </div>
                              <label className="ml-2 flex items-center gap-2 text-xs text-(--tc-text-muted)"><input type="checkbox" checked={onlyValid} onChange={(e) => setOnlyValid(e.target.checked)} className="h-4 w-4" /> Mostrar apenas válidos</label>
                            </div>

                            <div className="grid gap-2">
                              {(() => {
                                const filtered = qaseProjects.filter((p) => {
                                  const q = searchProjects.trim().toLowerCase();
                                  if (onlyValid && p.status !== "valid") return false;
                                  if (!q) return true;
                                  return p.code.toLowerCase().includes(q) || p.title.toLowerCase().includes(q);
                                });
                                const visible = filtered.slice(0, displayLimit);
                                return visible.map((p) => {
                                  const selected = Array.isArray(form.qaseProjectCodes) && form.qaseProjectCodes.includes(p.code);
                                  return (
                                    <label key={p.code} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition border ${selected ? "border-2 border-(--tc-accent,#ef0001) bg-(--tc-accent-soft,rgba(255,230,230,0.9))" : "border-transparent hover:border-(--tc-border) hover:bg-(--tc-surface-2)"}`}>
                                      <input type="checkbox" checked={selected} onChange={() => {
                                        const code = p.code;
                                        const current = Array.isArray(form.qaseProjectCodes) ? [...form.qaseProjectCodes] : [];
                                        if (current.includes(code)) {
                                          setForm((f) => ({ ...f, qaseProjectCodes: current.filter((c) => c !== code) }));
                                        } else {
                                          setForm((f) => ({ ...f, qaseProjectCodes: [...current, code] }));
                                        }
                                      }} className="h-5 w-5" />
                                      <div className="flex items-center gap-3 min-w-0">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-(--tc-surface-2) text-(--tc-text-muted)"><FiCloudLightning size={14} /></span>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="block font-semibold text-(--tc-text)">{p.title}</span>
                                            {p.status && <span className={`text-xs font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full ${p.status === "valid" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : p.status === "invalid" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-slate-100 text-slate-600 border border-slate-200"}`}>{p.status === "valid" ? "Válido" : p.status === "invalid" ? "Inválido" : "Pendente"}</span>}
                                          </div>
                                          <span className="text-xs text-(--tc-text-muted)">{p.code}</span>
                                        </div>
                                      </div>
                                    </label>
                                  );
                                });
                              })()}
                            </div>

                            <div className="mt-2 flex items-center justify-between">
                              <div className="text-xs text-(--tc-text-muted)">Exibindo {Math.min(displayLimit, qaseProjects.filter((p) => {
                                const q = searchProjects.trim().toLowerCase();
                                if (onlyValid && p.status !== "valid") return false;
                                if (!q) return true;
                                return p.code.toLowerCase().includes(q) || p.title.toLowerCase().includes(q);
                              }).length)} de {qaseProjects.length} carregados</div>
                              <div className="flex items-center gap-2">
                                {qaseProjects.filter((p) => {
                                  const q = searchProjects.trim().toLowerCase();
                                  if (onlyValid && p.status !== "valid") return false;
                                  if (!q) return true;
                                  return p.code.toLowerCase().includes(q) || p.title.toLowerCase().includes(q);
                                }).length > displayLimit ? (
                                  <button type="button" onClick={() => setDisplayLimit((d) => d + 10)} className="rounded-md px-3 py-1 text-xs font-semibold hover:bg-(--tc-surface-2)">Carregar mais</button>
                                ) : null}
                                <button type="button" onClick={() => setProjectsOpen(false)} className="rounded-md border px-3 py-1 text-xs font-semibold">Fechar</button>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <label className="block text-sm">Projeto principal
                                  <select className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm" value={form.qaseProjectCode ?? ""} onChange={(e) => setForm((f) => ({ ...f, qaseProjectCode: e.target.value }))} disabled={!(Array.isArray(form.qaseProjectCodes) && form.qaseProjectCodes.length)}>
                                    <option value="">{(Array.isArray(form.qaseProjectCodes) && form.qaseProjectCodes.length) ? "Selecione o projeto principal" : "Selecione primeiro os projetos vinculados"}</option>
                                    {(Array.isArray(form.qaseProjectCodes) ? form.qaseProjectCodes : []).map((code) => {
                                      const proj = qaseProjects.find((p) => p.code === code);
                                      return <option key={code} value={code}>{proj ? `${proj.title} (${proj.code})` : code}</option>;
                                    })}
                                  </select>
                                </label>
                              </div>
                              <div className="flex flex-col justify-center">
                                <div className="text-sm font-medium">Aplicações que serão criadas</div>
                                <div className="mt-1 text-xs text-(--tc-text-muted)">{(Array.isArray(form.qaseProjectCodes) ? form.qaseProjectCodes.length : 0)} aplicação{(Array.isArray(form.qaseProjectCodes) && form.qaseProjectCodes.length !== 1) ? "s" : ""}</div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-sm">
                        {currentHasQaseToken ? (
                          <div>Conexão: configurada — Projetos: {currentQaseProjects ?? "-"}</div>
                        ) : (
                          <div>Sem token da Qase configurado</div>
                        )}
                      </div>
                    )}
                  </div>
                </SectionCard>

                <SectionCard
                  eyebrow="Observações"
                  title="Descrição e notas"
                  description="Campos de contexto para leitura da lideranca e acompanhamento do cadastro."
                >
                  <div className="grid gap-3">
                    <DetailTextArea
                      label="Descrição"
                      value={isEditing ? form.description ?? "" : currentDescription ?? ""}
                      editable={isEditing}
                      onChange={(v) => setForm((f) => ({ ...f, description: v }))}
                    />
                    <DetailTextArea
                      label="Notas"
                      value={isEditing ? form.notes ?? "" : currentNotes ?? ""}
                      editable={isEditing}
                      onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
                    />
                  </div>
                </SectionCard>
              </div>
            )}

            {activeTab === "pessoas" && (
              <SectionCard
                eyebrow="Usuários"
                title="Usuários vinculados"
                description="Vincule usuários já cadastrados a esta empresa."
              >
                <CompanyUsers clientId={selected.id} companyName={currentName} />
              </SectionCard>
            )}
            </div>

            <div className="shrink-0 border-t border-(--tc-border) bg-(--tc-surface,#ffffff) px-6 py-4 md:px-7">
              {message && <p className="pb-3 text-sm text-red-600">{message}</p>}

              <div className="flex items-center justify-between gap-3">
                {!isEditing ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:opacity-60"
                    onClick={() => setCompanyAction("delete")}
                    disabled={saving}
                  >
                    <FiTrash2 size={15} />
                    Excluir empresa
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex justify-end gap-2">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-lg border border-[#e5e7eb] disabled:opacity-60"
                        onClick={() => {
                          resetForm();
                          setIsEditing(false);
                        }}
                        disabled={saving}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="px-3 py-2 rounded-lg border border-[#e5e7eb] disabled:opacity-60"
                        onClick={resetForm}
                        disabled={saving}
                      >
                        Limpar
                      </button>
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg bg-[#e53935] text-white font-semibold shadow disabled:opacity-60"
                        onClick={save}
                        disabled={saving}
                      >
                        Salvar dados
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg bg-[#0b1e3c] text-white font-semibold shadow disabled:opacity-60"
                      onClick={() => {
                        setActiveTab("visão");
                        setIsEditing(true);
                      }}
                    >
                      Editar dados
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && companyAction && (
        <CompanyActionModal
          action={companyAction}
          companyName={currentName}
          saving={saving}
          onClose={() => setCompanyAction(null)}
          onConfirm={() => {
            if (companyAction === "delete") {
              void deleteCompany();
              return;
            }
            void toggleCompanyStatus();
          }}
        />
      )}

      <CreateClientModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreate={handleCreateClient}
        onOpenUser={() => {}}
      />
    </div>
  );
}

export default AdminClientsPage;

type CompanyLogoProps = {
  logoUrl?: string | null;
  slug?: string | null;
  website?: string | null;
  name?: string | null;
  className?: string;
};

function CompanyLogo({ logoUrl, slug, website, name, className }: CompanyLogoProps) {
  const candidates = useMemo(
    () => resolveLogoCandidates({ logoUrl: logoUrl ?? null, slug: slug ?? null, website: website ?? null, name: name ?? null }),
    [logoUrl, slug, website, name],
  );
  const candidatesKey = candidates.join("|");
  const [imageState, setImageState] = useState<{ key: string; index: number; failed: boolean }>({
    key: candidatesKey,
    index: 0,
    failed: false,
  });
  const resolvedState =
    imageState.key === candidatesKey
      ? imageState
      : {
          key: candidatesKey,
          index: 0,
          failed: false,
        };

  const normalizedClass = className ? className.trim() : "";
  const alt = (name && name.trim()) || "Logo da empresa";
  const currentSrc = candidates[resolvedState.index] ?? null;

  if (!currentSrc || resolvedState.failed) {
    const initials = getInitials(name);
    return (
      <span
        role="img"
        aria-label={alt}
        className={`inline-flex h-full w-full items-center justify-center rounded bg-(--tc-surface-2,#f3f4f6) text-xs font-semibold uppercase text-(--tc-text-muted,#6b7280) ${normalizedClass}`.trim()}
      >
        {initials}
      </span>
    );
  }

  const handleError = () => {
    if (resolvedState.index < candidates.length - 1) {
      setImageState({
        key: candidatesKey,
        index: resolvedState.index + 1,
        failed: false,
      });
      return;
    }

    setImageState({
      key: candidatesKey,
      index: resolvedState.index,
      failed: true,
    });
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={alt}
      loading="lazy"
      className={`h-full w-full object-cover ${normalizedClass}`.trim()}
      onError={handleError}
    />
  );
}

function IconButton({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={title}
      className="p-2 rounded-lg border border-white/30 bg-white/10 text-white hover:border-white/60 transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-black/20"
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function CompanyActionModal({
  action,
  companyName,
  saving,
  onClose,
  onConfirm,
}: {
  action: "activate" | "deactivate" | "delete";
  companyName: string;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isDelete = action === "delete";
  const isDeactivate = action === "deactivate";
  const ActionIcon = isDelete ? FiTrash2 : isDeactivate ? FiXCircle : FiCheckCircle;
  const title = isDelete ? "Excluir empresa" : isDeactivate ? "Inativar empresa" : "Ativar empresa";
  const description = isDelete
    ? "Esta ação remove o cadastro da empresa e encerra os vínculos existentes com ela."
    : isDeactivate
      ? "Ao inativar a empresa, o acesso a ela deixa de estar disponível na plataforma."
      : "Ao ativar a empresa, os acessos vinculados voltam a operar normalmente.";
  const confirmLabel = isDelete ? "Excluir empresa" : isDeactivate ? "Inativar empresa" : "Ativar empresa";
  const headerClasses = isDelete || isDeactivate
    ? "from-[#04153d] via-[#30122e] to-[#ef0001]"
    : "from-[#04153d] via-[#0b1e3c] to-[#7a1026]";
  const eyebrowChip = isDelete || isDeactivate
    ? "border-white/15 bg-white/10 text-white/90"
    : "border-cyan-300/30 bg-cyan-400/10 text-cyan-100";
  const impactCardClasses = isDelete || isDeactivate
    ? "border-[#ef0001]/20 bg-[#fff4f5]"
    : "border-[#0b5cab]/20 bg-[#f3f8ff]";
  const impactTitleClasses = isDelete || isDeactivate ? "text-[#b10f22]" : "text-[#0b3b78]";
  const impactTextClasses = isDelete || isDeactivate ? "text-[#7f1d1d]" : "text-[#163d6b]";
  const guidanceCardClasses = "border-[#011848]/12 bg-[linear-gradient(180deg,rgba(1,24,72,0.03),rgba(122,16,38,0.04))]";
  const confirmButtonClasses = isDelete || isDeactivate
    ? "bg-linear-to-r from-[#7a1026] to-[#ef0001]"
    : "bg-linear-to-r from-[#011848] to-[#0b5cab]";
  const actionTag = isDelete ? "Exclusão definitiva" : isDeactivate ? "Bloqueio de acesso" : "Reativação";
  const impactItems = isDelete
    ? [
        "Todos os usuários vinculados perdem o acesso à empresa e aos dados dela.",
        "Os vínculos com esta empresa serão removidos do sistema.",
        "O cadastro deixa de existir na base após a confirmação.",
      ]
    : isDeactivate
      ? [
          "Todos os usuários vinculados deixam de acessar esta empresa e os dados dela.",
          "A empresa sai do fluxo operacional enquanto estiver inativa.",
          "A reativação volta a liberar o acesso sem recriar o cadastro.",
        ]
      : [
          "Os acessos vinculados voltam a operar normalmente.",
          "A empresa retorna ao fluxo operacional da plataforma.",
          "Os usuários voltam a visualizar a empresa e os dados dela.",
        ];
  const guidanceItems = isDelete
    ? [
        "Use esta ação apenas quando a empresa não precisar mais existir na base.",
        "Para pausar o acesso sem apagar o cadastro, prefira a inativação.",
      ]
    : isDeactivate
      ? [
          "Use inativação para bloquear o acesso sem apagar o cadastro.",
          "A empresa continua cadastrada e pode ser reativada depois.",
        ]
      : [
          "Use a ativação quando a empresa estiver pronta para voltar a operar.",
          "Os vínculos atuais continuam válidos após a reativação.",
        ];

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center overflow-y-auto bg-[rgba(2,10,28,0.62)] px-4 py-6 backdrop-blur-[3px]">
      <div className="my-auto w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-hidden rounded-[30px] border border-white/12 bg-(--tc-surface,#ffffff) shadow-[0_32px_90px_rgba(15,23,42,0.5)]">
        <div className={`relative overflow-hidden bg-linear-to-r ${headerClasses} px-6 py-6 text-white`}>
          <div className="pointer-events-none absolute -left-8 top-0 h-28 w-28 rounded-full bg-white/8 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-4 h-28 w-28 rounded-full bg-[#ef0001]/20 blur-3xl" />
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/8 shadow-inner">
              <ActionIcon size={22} />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white! ${eyebrowChip}`}>
                  Ação sensível
                </span>
                <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white!">
                  {actionTag}
                </span>
              </div>
              <h3 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-white! drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]">{title}</h3>
              <p className="max-w-2xl text-sm leading-6 text-white/95!">{description}</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-(--tc-border) bg-[linear-gradient(180deg,rgba(1,24,72,0.02),rgba(239,0,1,0.03))] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-accent)">Empresa afetada</p>
            <p className="mt-2 text-xl font-bold tracking-[-0.02em] text-(--tc-text-primary)">{companyName}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className={`rounded-2xl border p-4 ${impactCardClasses}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${impactTitleClasses}`}>Impacto nos acessos</p>
              <ul className={`mt-2 space-y-2 text-sm leading-6 ${impactTextClasses}`}>
                {impactItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className={`rounded-2xl border p-4 ${guidanceCardClasses}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-accent)">Orientação</p>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-(--tc-text-secondary)">
                {guidanceItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-(--tc-border) pt-4">
            <button
              type="button"
              className="rounded-lg border border-(--tc-border) bg-(--tc-surface-2) px-4 py-2 text-sm font-semibold text-(--tc-text-primary) transition hover:border-(--tc-accent)/30 hover:bg-(--tc-surface) disabled:opacity-60"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(15,23,42,0.22)] transition hover:brightness-105 disabled:opacity-60 ${confirmButtonClasses}`}
              onClick={onConfirm}
              disabled={saving}
            >
              {saving ? "Processando..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderLinkTag({
  href,
  label,
  external,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90 transition hover:bg-white/16"
    >
      {label}
    </a>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={["rounded-2xl border border-(--tc-border) bg-(--tc-surface-2) p-3.5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]", className].filter(Boolean).join(" ")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent)">{eyebrow}</p>
          <h3 className="text-lg font-semibold text-(--tc-text-primary)">{title}</h3>
          {description ? <p className="max-w-2xl text-sm text-(--tc-text-muted)">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DetailField({
  label,
  value,
  editable,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  editable?: boolean;
  onChange?: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword && showPassword ? "text" : type;

  return (
    <label className="block text-sm text-(--tc-text-primary)">
      {label}
      <div className="relative mt-1">
        <input
          className={`w-full rounded-lg border border-(--tc-border) px-3 py-2 text-sm text-(--tc-text-primary) ${isPassword ? "pr-10" : ""} ${
            editable
              ? "bg-(--tc-surface) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/30 focus:border-(--tc-accent)"
              : "bg-(--tc-surface-2) text-(--tc-text-secondary)"
          }`}
          value={value}
          type={resolvedType}
          readOnly={!editable}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        {isPassword && editable ? (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-2 flex items-center text-(--tc-text-muted) hover:text-(--tc-text-primary)"
            aria-label={showPassword ? "Esconder token" : "Mostrar token"}
            tabIndex={-1}
          >
            {showPassword ? <FiEyeOff size={16} aria-hidden /> : <FiEye size={16} aria-hidden />}
          </button>
        ) : null}
      </div>
    </label>
  );
}

function DetailTextArea({
  label,
  value,
  editable,
  onChange,
}: {
  label: string;
  value: string;
  editable?: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <label className="block text-sm text-(--tc-text-primary)">
      {label}
      <textarea
        className={`mt-1 w-full rounded-lg border border-(--tc-border) px-3 py-2 text-sm text-(--tc-text-primary) ${
          editable
            ? "bg-(--tc-surface) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/30 focus:border-(--tc-accent)"
            : "bg-(--tc-surface-2) text-(--tc-text-secondary)"
        }`}
        rows={2}
        value={value}
        readOnly={!editable}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </label>
  );
}

function DetailSelectField({
  label,
  value,
  editable,
  onChange,
  options,
}: {
  label: string;
  value: string;
  editable?: boolean;
  onChange?: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  if (!editable) {
    const selectedOption = options.find((option) => option.value === value)?.label ?? value;
    return <DetailField label={label} value={selectedOption} />;
  }

  return (
    <label className="block text-sm text-(--tc-text-primary)">
      {label}
      <select
        className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-surface) px-3 py-2 text-sm text-(--tc-text-primary) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/30 focus:border-(--tc-accent)"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type CompanyUsersProps = {
  clientId: string;
  companyName: string;
  disabled?: boolean;
};

function CompanyUsers({ clientId, companyName, disabled = false }: CompanyUsersProps) {
  const router = useRouter();
  const [users, setUsers] = useState<Array<{
    id: string;
    name: string;
    user?: string | null;
    email?: string | null;
    permission_role?: string | null;
    avatar_url?: string | null;
    active?: boolean;
    status?: string | null;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [openLinkModal, setOpenLinkModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Array<{
    id: string;
    name: string;
    user?: string | null;
    email?: string | null;
    permission_role?: string | null;
    active?: boolean;
    status?: string | null;
  }>>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [linking, setLinking] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [search, setSearch] = useState("");
  const [openCreateUserModal, setOpenCreateUserModal] = useState(false);

  const loadLinkedUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchApi(`/api/admin/users?client_id=${clientId}`);
      if (res.status === 401) {
        toast.error("Sessao expirada. Faca login novamente.");
        router.replace("/login");
        setUsers([]);
        return;
      }
      const json = await res.json().catch(() => ({ items: [] }));
      setUsers(Array.isArray(json.items) ? json.items : []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, router]);

  useEffect(() => {
    void loadLinkedUsers();
  }, [loadLinkedUsers]);

  const loadAvailableUsers = useCallback(async () => {
    setLoadingAvailable(true);
    try {
      const res = await fetchApi("/api/admin/users");
      if (res.status === 401) {
        toast.error("Sessao expirada. Faca login novamente.");
        router.replace("/login");
        setAvailableUsers([]);
        return;
      }
      const json = await res.json().catch(() => ({ items: [] }));
      const items = Array.isArray(json.items) ? json.items : [];
      const linkedIds = new Set(users.map((user) => user.id));
      setAvailableUsers(
        items.filter(
          (item: { id: string; permission_role?: string | null }) => {
            const role = normalizeLegacyRole(item?.permission_role);
            return role !== SYSTEM_ROLES.TECHNICAL_SUPPORT && role !== SYSTEM_ROLES.LEADER_TC && !linkedIds.has(item.id);
          },
        ),
      );
    } catch {
      setAvailableUsers([]);
    } finally {
      setLoadingAvailable(false);
    }
  }, [router, users]);

  const filteredAvailableUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return availableUsers;
    return availableUsers.filter((user) =>
      [user.name, user.user, user.email].some((value) => (value ?? "").toLowerCase().includes(term)),
    );
  }, [availableUsers, search]);

  async function handleLinkUser() {
    if (!selectedUserId || linking) return;
    setLinking(true);
    try {
      const res = await fetchApi(`/api/admin/clients/${clientId}/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      if (res.status === 401) {
        toast.error("Sessao expirada. Faca login novamente.");
        router.replace("/login");
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(extractMessageFromJson(json) || "Não foi possível vincular o usuário");
        return;
      }
      toast.success("Usuário vinculado");
      setOpenLinkModal(false);
      setSelectedUserId("");
      setSearch("");
      await loadLinkedUsers();
    } finally {
      setLinking(false);
    }
  }

  async function handleRemoveLink(userId: string) {
    if (disabled || removingId) return;
    setRemovingId(userId);
    try {
      const res = await fetchApi(`/api/admin/clients/${clientId}/people/${userId}`, {
        method: "DELETE",
      });
      if (res.status === 401) {
        toast.error("Sessao expirada. Faca login novamente.");
        router.replace("/login");
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(extractMessageFromJson(json) || "Não foi possível remover o vínculo");
        return;
      }
      toast.success("Vínculo removido");
      await loadLinkedUsers();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-(--tc-text-secondary)">Gerencie os usuários vinculados a esta empresa.</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              setSelectedUserId("");
              setSearch("");
              setOpenLinkModal(true);
              void loadAvailableUsers();
            }}
          >
            Vincular usuário
          </button>
          <button
            type="button"
            className={`rounded-lg border border-(--tc-accent)/20 bg-white px-3 py-2 text-sm font-semibold text-(--tc-accent) transition hover:border-(--tc-accent)/40 hover:bg-(--tc-surface) ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              setOpenCreateUserModal(true);
            }}
          >
            Criar usuário
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Carregando usuários...</p>}
      {!loading && users.length === 0 && <p className="text-sm text-gray-500">Nenhum usuário vinculado a esta empresa.</p>}
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-(--tc-border) bg-(--tc-surface) px-3 py-3">
            <div className="flex items-center gap-2">
              {u.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.avatar_url} alt={u.name} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-(--tc-surface-2) flex items-center justify-center text-xs text-(--tc-text-muted)">
                  {u.name?.slice(0, 1)?.toUpperCase() ?? "U"}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium">{u.name}</div>
                <div className="truncate text-xs text-(--tc-text-muted)">
                  {u.user ? `@${u.user}` : u.email ?? "Sem identificação"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-full border border-(--tc-border) bg-(--tc-surface-2) px-2.5 py-1 text-[11px] font-semibold text-(--tc-text-secondary)">
                {companyName}
              </span>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  u.active === false || u.status === "inactive"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {u.active === false || u.status === "inactive" ? "Inativo" : "Ativo"}
              </span>
              <button
                type="button"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                  disabled
                    ? "cursor-not-allowed border-(--tc-border) text-gray-400"
                    : "border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50"
                }`}
                disabled={disabled || removingId === u.id}
                title={removingId === u.id ? "Removendo vínculo" : "Remover vínculo"}
                aria-label={removingId === u.id ? "Removendo vínculo" : "Remover vínculo"}
                onClick={() => {
                  if (disabled) return;
                  void handleRemoveLink(u.id);
                }}
              >
                {removingId === u.id ? <span className="text-[10px]">...</span> : <FiX size={14} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {openLinkModal && (
        <div className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto bg-[rgba(2,10,28,0.48)] px-4 py-6 backdrop-blur-[2px]">
          <div className="my-auto w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-hidden rounded-[28px] border border-white/10 bg-(--tc-surface,#ffffff) shadow-[0_28px_80px_rgba(15,23,42,0.32)]">
            <div className="bg-linear-to-r from-[#04153d] via-[#0b1e3c] to-[#7a1026] px-5 py-5 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75">Usuários</p>
              <div className="mt-2 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-extrabold">Vincular usuário</h3>
                  <p className="mt-2 text-sm text-white/85">Selecione um usuário já cadastrado para associar a esta empresa.</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                  onClick={() => {
                    setOpenLinkModal(false);
                    setSelectedUserId("");
                    setSearch("");
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              <label className="block text-sm text-(--tc-text-primary)">
                Buscar usuário
                <input
                  className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-surface) px-3 py-2 text-sm"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome, usuário ou e-mail"
                />
              </label>

              <label className="block text-sm text-(--tc-text-primary)">
                Usuário disponível
                <select
                  className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-surface) px-3 py-2 text-sm"
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                >
                  <option value="">Selecione um usuário</option>
                  {filteredAvailableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} {user.user ? `(@${user.user})` : user.email ? `(${user.email})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-xl border border-(--tc-border) bg-(--tc-surface-2) px-3 py-3 text-sm text-(--tc-text-secondary)">
                {loadingAvailable
                  ? "Carregando usuários disponíveis..."
                  : filteredAvailableUsers.length > 0
                    ? `${filteredAvailableUsers.length} usuários disponíveis para vínculo.`
                    : "Nenhum usuário disponível para vincular."}
              </div>

              <div className="flex justify-end gap-2 border-t border-(--tc-border) pt-4">
                <button
                  type="button"
                  className="rounded-lg border border-(--tc-border) px-4 py-2 text-sm font-semibold text-(--tc-text-primary)"
                  onClick={() => {
                    setOpenLinkModal(false);
                    setSelectedUserId("");
                    setSearch("");
                  }}
                  disabled={linking}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[#0b1e3c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={() => void handleLinkUser()}
                  disabled={!selectedUserId || linking}
                >
                  {linking ? "Vinculando..." : "Vincular usuário"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CreateUserModal
        open={openCreateUserModal}
        clientId={clientId}
        clients={[{ id: clientId, name: companyName }]}
        initialRole="company_user"
        onClose={() => setOpenCreateUserModal(false)}
        onCreated={async () => {
          await loadLinkedUsers();
        }}
      />
    </div>
  );
}
