"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateClientModal, type ClientFormValues } from "@/clients/components/CreateClientModal";
import { CreateUserModal } from "@/admin/users/components/CreateUserModal";
import { useAuthUser } from "@/hooks/useAuthUser";
import { getAccessToken } from "@/lib/api";
import { extractMessageFromJson, extractRequestIdFromJson, formatMessageWithRequestId, readApiError, unwrapEnvelopeData } from "@/lib/apiEnvelope";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";
import Image from "next/image";
import { FiExternalLink, FiUsers, FiX, FiCheckCircle, FiXCircle } from "react-icons/fi";
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
  notes?: string | null;
  integrationMode?: "qase" | "manual" | null;
  qaseProjectCode?: string | null;
  qaseProjectCodes?: string[] | null;
  qaseToken?: string | null;
  jiraBaseUrl?: string | null;
  jiraEmail?: string | null;
  jiraApiToken?: string | null;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

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
    notes: readNullableString(row.notes),
    integrationMode: readNullableString(row.integration_mode) as "qase" | "manual" | null,
    qaseProjectCode: readNullableString(row.qase_project_code),
    qaseProjectCodes: readProjectCodes(row.qase_project_codes),
    qaseToken: null,
    jiraBaseUrl: readNullableString(row.jira_base_url),
    jiraEmail: readNullableString(row.jira_email),
    jiraApiToken: null,
    active: readBoolean(row.active),
    createdAt: readNullableString(row.created_at),
    updatedAt: readNullableString(row.updated_at),
  };
}

function AdminClientsPage() {
  const router = useRouter();
  const { user } = useAuthUser();
  const isGlobalAdmin = !!user?.isGlobalAdmin || (user as { is_global_admin?: boolean } | null)?.is_global_admin === true;

  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Client>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"visao" | "pessoas">("visao");
  const [openCreate, setOpenCreate] = useState(false);
  const [openUserModal, setOpenUserModal] = useState(false);
  const [userClientId, setUserClientId] = useState<string | null>(null);

  const selected = useMemo(() => items.find((c) => c.id === selectedId) ?? null, [items, selectedId]);
  const currentActive = form.active ?? selected?.active ?? false;
  const isInactive = !currentActive;
  const resetForm = () => {
    if (selected) setForm(selected);
  };

  const handleUnauthorized = useCallback(() => {
    const msg = "SessÃ£o expirada. FaÃ§a login novamente.";
    setMessage(msg);
    toast.error(msg);
    router.replace("/login");
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = await getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch("/api/clients", { cache: "no-store", headers, credentials: "include" });
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
    setUserClientId(id);
    setIsEditing(false);
    setMessage(null);
    try {
      const token = await getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/clients/${id}`, { cache: "no-store", headers, credentials: "include" });
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
        setMessage("Nao foi possivel carregar o cliente selecionado");
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
    setActiveTab("visao");
  }

  async function save() {
    if (!selectedId) return;
    setSaving(true);
    setMessage(null);
    try {
      const token = await getAccessToken();
      const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const payload = {
        name: form.name,
        tax_id: form.taxId,
        address: form.address,
        description: form.description,
        phone: form.phone,
        website: form.website,
        logo_url: form.logoUrl,
        docs_link: form.docsLink,
        notes: form.notes,
        active: form.active,
        integration_mode: form.integrationMode,
        qase_project_code: form.qaseProjectCode,
        qase_project_codes: form.qaseProjectCodes,
        qase_token: form.qaseToken && form.qaseToken.trim() ? form.qaseToken : undefined,
        jira_base_url: form.jiraBaseUrl,
        jira_email: form.jiraEmail,
        jira_api_token: form.jiraApiToken && form.jiraApiToken.trim() ? form.jiraApiToken : undefined,
      };
      const res = await fetch(`/api/clients/${selectedId}`, {
        method: "PATCH",
        headers,
        credentials: "include",
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
        setItems((prev) => prev.map((c) => (c.id === selectedId ? mapClient(updated) : c)));
      }
      closeModal();
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
      const token = await getAccessToken();
      const normalizedCodes = Array.isArray(data.qaseProjectCodes) && data.qaseProjectCodes.length ? data.qaseProjectCodes : undefined;
      const legacyProjectCode =
        data.integrationMode === "qase"
          ? (data.qaseProjectCode || normalizedCodes?.[0])
          : undefined;
      const payload = {
        name: data.name,
        company_name: data.name,
        tax_id: data.taxId,
        address: [data.zip, data.address ?? data.description].filter(Boolean).join(" | "),
        phone: data.phone,
        website: data.website,
        logo_url: data.logoUrl,
        docs_link: data.linkedin,
        notes: data.notes,
        active: data.active,
        description: data.description,
        integration_mode: data.integrationMode,
        qase_token: data.integrationMode === "qase" ? data.qaseToken : undefined,
        qase_project_code: legacyProjectCode,
        qase_project_codes: data.integrationMode === "qase" ? normalizedCodes : undefined,
        jira_base_url: data.jiraBaseUrl,
        jira_email: data.jiraEmail,
        jira_api_token: data.jiraApiToken,
      };
      const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const res = await fetch("/api/clients", {
        method: "POST",
        headers,
        credentials: "include",
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
        setUserClientId(created.id);
        if (data.integrationMode === "manual") {
          setMessage(
            "Empresa criada sem integraÃ§Ã£o. VocÃª pode configurar Qase depois (token + project code) ou seguir em modo manual.",
          );
        }
        toast.success("Empresa cadastrada");
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
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-10 space-y-4">
        <Breadcrumb items={[{ label: "Admin", href: "/admin/home" }, { label: "Empresas" }]} />

        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-(--tc-text-primary,#0b1a3c)">Empresas</h1>
            <p className="text-sm sm:text-base text-(--tc-text-muted,#6b7280)">Gerencie clientes e usuÃ¡rios</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          {isGlobalAdmin && (
            <button
              type="button"
              onClick={() => setOpenCreate(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              + Cadastrar empresa
            </button>
          )}
          {isGlobalAdmin && (
            <a
              href="/admin/users"
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              Gerenciar usuÃ¡rios
            </a>
          )}
            <button
              type="button"
              onClick={load}
              className="rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-surface,#ffffff) px-3 py-2 text-sm text-(--tc-text-primary,#0b1a3c) hover:bg-(--tc-surface-2,#f3f4f6) focus:outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)/30 disabled:opacity-60"
              disabled={loading}
            >
              Atualizar
            </button>
          </div>
        </div>

        {message && (
          <p role="status" aria-live="polite" className="text-sm text-red-600">
            {message}
          </p>
        )}
        {loading && (
          <p role="status" aria-live="polite" className="text-sm text-(--tc-text-muted,#6b7280)">
            Carregando...
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((client) => (
            <button
              type="button"
              key={client.id}
              onClick={() => openModal(client.id)}
              className="w-full text-left rounded-lg border border-(--tc-border,#e5e7eb) p-4 bg-(--tc-surface,#ffffff) hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
                <div className="flex flex-row flex-wrap items-center gap-3">
                  <div className="h-12 w-12 rounded logo-background overflow-hidden flex items-center justify-center">
                  {client.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={client.logoUrl}
                      alt={client.name}
                      className="h-full w-full object-contain logo-image"
                    />
                  ) : (
                    <span className="text-xs text-(--tc-text-muted,#6b7280)">Sem logo</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate" title={client.name}>
                    {client.name}
                  </div>
                  <div className="text-xs text-(--tc-text-secondary,#4b5563)">{client.active ? "Ativo" : "Inativo"}</div>
                  <div className="text-xs text-(--tc-text-muted,#6b7280) flex flex-wrap gap-2">
                    {client.taxId && <span>{client.taxId}</span>}
                    {client.website && (
                      <span className="text-indigo-600 truncate" title={client.website}>
                        {client.website}
                      </span>
                    )}
                    {client.createdAt && <span>Criado em {new Date(client.createdAt).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
            </button>
          ))}
          {items.length === 0 && !loading && (
            <div className="text-sm text-(--tc-text-muted,#6b7280)">
              {isGlobalAdmin ? (
                <div className="mt-2 rounded-xl border border-dashed border-(--tc-border,#e5e7eb) p-4 text-center">
                  <p className="text-sm text-(--tc-text-secondary,#4b5563)">VocÃª ainda nÃ£o criou nenhum cliente.</p>
                  <button
                    type="button"
                    onClick={() => setOpenCreate(true)}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    + Cadastrar instituiÃ§Ã£o ou empresa
                  </button>
                </div>
              ) : (
                <p>Nenhum cliente encontrado.</p>
              )}
            </div>
          )}
        </div>

      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 py-6 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-modal-title"
            className="w-full max-w-4xl bg-(--tc-surface,#ffffff) rounded-3xl shadow-2xl p-6 md:p-7 space-y-6 max-h-[calc(100vh-96px)] overflow-y-auto border border-(--tc-border,#e5e7eb)"
          >
            {/* Header */}
            <div className="rounded-2xl bg-linear-to-r from-[#0b1e3c] via-[#0f274d] to-[#0b1e3c] text-white p-5 relative overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-white/80">Painel da empresa</p>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl logo-background border border-white/20 flex items-center justify-center overflow-hidden shadow-inner">
                      {form.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={form.logoUrl as string}
                          alt={form.name || selected.name}
                          className="h-full w-full object-contain logo-image"
                        />
                      ) : (
                        <span className="text-xs text-white/80">Logo</span>
                      )}
                    </div>
                    <div className="min-w-45">
                      <h2
                        id="client-modal-title"
                        className="text-2xl font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] leading-tight"
                      >
                        {(form.name && form.name.trim()) || selected.name}
                      </h2>
                      {form.slug || selected.slug ? (
                        <p className="text-xs text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
                          slug: {form.slug || selected.slug}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      aria-pressed={form.active ?? selected.active}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs border transition ${
                        form.active ?? selected.active
                          ? "bg-emerald-500 text-white border-emerald-400"
                          : "bg-amber-200 text-amber-800 border-amber-300"
                      }`}
                      onClick={() => {
                        const next = !(form.active ?? selected.active);
                        setIsEditing(true);
                        setForm((f) => ({ ...f, active: next }));
                      }}
                      title="Alterar status (confirme ao salvar)"
                    >
                      {form.active ?? selected.active ? <FiCheckCircle size={12} /> : <FiXCircle size={12} />}
                      {form.active ?? selected.active ? "Ativa" : "Inativa"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <ActionChip
                      href={`/empresas/${form.slug || selected.slug || selected.id}/dashboard`}
                      icon={<FiExternalLink size={14} />}
                      label="Entrar na empresa"
                      disabled={isInactive}
                    />
                    {form.website && (
                      <ActionChip
                        href={form.website}
                        icon={<FiExternalLink size={14} />}
                        label="Site oficial"
                        external
                        disabled={isInactive}
                      />
                    )}
                    {form.docsLink && (
                      <ActionChip
                        href={form.docsLink}
                        icon={<FiExternalLink size={14} />}
                        label="Documentos/LinkedIn"
                        external
                        disabled={isInactive}
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton
                    title="Acessar perfil"
                    onClick={() => {
                      const slug = form.slug || selected.slug || selected.id;
                      window.open(`/empresas/${slug}/dashboard`, "_blank");
                    }}
                    disabled={isInactive}
                  >
                    <FiExternalLink size={16} />
                  </IconButton>
                  <IconButton
                    title="Gerenciar equipe"
                    onClick={() => {
                      setUserClientId(selected.id);
                      setOpenUserModal(true);
                    }}
                    disabled={isInactive}
                  >
                    <FiUsers size={16} />
                  </IconButton>
                  <IconButton title="Fechar" onClick={closeModal}>
                    <FiX size={16} />
                  </IconButton>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div role="tablist" aria-label="Detalhes da empresa" className="flex items-center gap-3 border-b border-(--tc-border) pb-2">
              <TabButton active={activeTab === "visao"} onClick={() => setActiveTab("visao")}>
                Visao Geral
              </TabButton>
              <TabButton active={activeTab === "pessoas"} onClick={() => setActiveTab("pessoas")}>
                Pessoas
              </TabButton>
            </div>

            {/* Tab content */}
            {activeTab === "visao" && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <InfoCard label="CNPJ" value={form.taxId ?? selected.taxId} />
                  <InfoCard label="CEP / Endereco" value={form.address ?? selected.address} />
                  <InfoCard label="Telefone" value={form.phone ?? selected.phone} />
                  <InfoCard label="Website" value={form.website ?? selected.website} isLink />
                  <InfoCard label="LinkedIn / Docs" value={form.docsLink ?? selected.docsLink} isLink />
                  <InfoCard
                    label="Integracao"
                    value={(form.integrationMode ?? selected.integrationMode) === "qase" ? "Qase" : "Manual"}
                  />
                  <InfoCard label="Qase Project" value={form.qaseProjectCode ?? selected.qaseProjectCode} />
                  <InfoCard
                    label="Qase Projects"
                    value={((form.qaseProjectCodes !== undefined ? form.qaseProjectCodes : selected.qaseProjectCodes) ?? null)?.join(", ") ?? null}
                  />
                  <InfoCard label="Jira URL" value={form.jiraBaseUrl ?? selected.jiraBaseUrl} isLink />
                  <InfoCard label="Jira Email" value={form.jiraEmail ?? selected.jiraEmail} />
                  <InfoCard label="Notas" value={form.notes ?? selected.notes} full />
                  <InfoCard label="Descricao" value={form.description ?? selected.description} full />
                </div>

                {isEditing && (
                  <div className="rounded-xl border border-(--tc-border) bg-(--tc-surface-2) p-4 space-y-3">
                    <EditField label="Nome" value={form.name ?? ""} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
                    <EditField label="CNPJ" value={form.taxId ?? ""} onChange={(v) => setForm((f) => ({ ...f, taxId: v }))} />
                    <EditField label="CEP / Endereco" value={form.address ?? ""} onChange={(v) => setForm((f) => ({ ...f, address: v }))} />
                    <EditField label="Telefone" value={form.phone ?? ""} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
                    <EditField label="Website" value={form.website ?? ""} onChange={(v) => setForm((f) => ({ ...f, website: v }))} />
                    <EditField label="LinkedIn / Docs" value={form.docsLink ?? ""} onChange={(v) => setForm((f) => ({ ...f, docsLink: v }))} />
                    <EditTextArea label="Descricao" value={form.description ?? ""} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
                    <EditTextArea label="Notas" value={form.notes ?? ""} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} />

                    <div className="rounded-lg border border-(--tc-border) bg-(--tc-surface) p-3">
                      <p className="text-sm font-semibold text-(--tc-text-primary)">Integracoes (Qase / Jira)</p>
                      <p className="mt-1 text-xs text-(--tc-text-muted)">
                        Tokens nao aparecem por seguranca. Para trocar, informe um novo token e salve.
                      </p>

                      <label className="block text-sm mt-3">
                        Modo de integracao
                        <select
                          className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-surface) px-3 py-2 text-sm"
                          value={(form.integrationMode ?? "manual") as string}
                          onChange={(e) => setForm((f) => ({ ...f, integrationMode: e.target.value as "qase" | "manual" }))}
                        >
                          <option value="manual">Manual</option>
                          <option value="qase">Qase</option>
                        </select>
                      </label>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <EditField
                          label="Qase Project Code"
                          value={form.qaseProjectCode ?? ""}
                          onChange={(v) => setForm((f) => ({ ...f, qaseProjectCode: v }))}
                        />
                        <EditTextArea
                          label="Qase Project Codes (um por linha, opcional)"
                          value={((form.qaseProjectCodes !== undefined ? form.qaseProjectCodes : selected.qaseProjectCodes) ?? null)?.join("\n") ?? ""}
                          onChange={(v) => {
                            const codes = v
                              .split(/[\s,;|]+/g)
                              .map((code) => code.trim().toUpperCase())
                              .filter(Boolean);
                            const uniq = codes.length ? Array.from(new Set(codes)) : null;
                            setForm((f) => ({ ...f, qaseProjectCodes: uniq }));
                          }}
                        />
                        <label className="block text-sm">
                          Novo token da Qase
                          <input
                            className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-surface) px-3 py-2 text-sm"
                            type="password"
                            value={form.qaseToken ?? ""}
                            onChange={(e) => setForm((f) => ({ ...f, qaseToken: e.target.value }))}
                            placeholder="(deixe em branco para manter)"
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </label>

                        <EditField
                          label="Jira URL base"
                          value={form.jiraBaseUrl ?? ""}
                          onChange={(v) => setForm((f) => ({ ...f, jiraBaseUrl: v }))}
                        />
                        <EditField
                          label="Jira e-mail"
                          value={form.jiraEmail ?? ""}
                          onChange={(v) => setForm((f) => ({ ...f, jiraEmail: v }))}
                        />
                        <label className="block text-sm md:col-span-2">
                          Novo API token do Jira
                          <input
                            className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-surface) px-3 py-2 text-sm"
                            type="password"
                            value={form.jiraApiToken ?? ""}
                            onChange={(e) => setForm((f) => ({ ...f, jiraApiToken: e.target.value }))}
                            placeholder="(deixe em branco para manter)"
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "pessoas" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-(--tc-text-primary)">Pessoas desta empresa</h3>
                  <button
                    type="button"
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:border-indigo-300 dark:border-indigo-400/40 dark:bg-indigo-500/15 dark:text-indigo-200"
                    onClick={() => {
                      setUserClientId(selected.id);
                      setOpenUserModal(true);
                    }}
                    disabled={isInactive}
                  >
                    + Adicionar
                  </button>
                </div>
                <CompanyUsers
                  clientId={selected.id}
                  disabled={isInactive}
                  onAddUser={() => {
                    setUserClientId(selected.id);
                    setOpenUserModal(true);
                  }}
                />
              </div>
            )}

            {message && <p className="text-sm text-red-600">{message}</p>}

            <div className="flex justify-end gap-2 pt-2">
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
                  onClick={() => setIsEditing(true)}
                  disabled={isInactive}
                >
                  Editar dados
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <CreateClientModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreate={handleCreateClient}
        onOpenUser={(id) => {
          setUserClientId(id);
          setOpenUserModal(true);
        }}
      />
      <CreateUserModal
        open={openUserModal}
        clientId={userClientId}
        clients={items.map((c) => ({ id: c.id, name: c.name }))}
        onClose={() => setOpenUserModal(false)}
        onCreated={async () => {
          load();
        }}
      />
    </div>
  );
}

export default function AdminClientsPageWithGuard() {
  return (
    <RequireGlobalAdmin>
      <AdminClientsPage />
    </RequireGlobalAdmin>
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
function ActionChip({
  href,
  label,
  icon,
  external,
  disabled,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  external?: boolean;
  disabled?: boolean;
}) {
  const finalHref = disabled ? undefined : href;

  return (
    <a
      href={finalHref}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      target={!disabled && external ? "_blank" : undefined}
      rel={!disabled && external ? "noreferrer" : undefined}
      className={`inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/30 px-3 py-1 text-xs text-white transition ${
        disabled ? "opacity-50 pointer-events-none" : "hover:bg-white/15"
      }`}
    >
      {icon}
      {label}
    </a>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-3 py-2 text-sm font-semibold border-b-2 transition ${
        active
          ? "text-(--tc-text-primary) border-(--tc-accent)"
          : "text-(--tc-text-muted) border-transparent hover:text-(--tc-text-primary)"
      }`}
    >
      {children}
    </button>
  );
}

function InfoCard({ label, value, isLink, full }: { label: string; value?: string | null; isLink?: boolean; full?: boolean }) {
  if (!value) return null;
  const content = isLink ? (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      className="text-(--tc-accent) font-semibold hover:underline break-all"
    >
      {value}
    </a>
  ) : (
    <p className="text-(--tc-text-primary)">{value}</p>
  );
  return (
    <div className={`rounded-xl border border-(--tc-border) bg-(--tc-surface) p-3 ${full ? "md:col-span-2" : ""}`}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-(--tc-text-muted)">{label}</p>
      {content}
    </div>
  );
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm text-(--tc-text-primary)">
      {label}
      <input
        className="mt-1 w-full px-3 py-2 border rounded-lg border-(--tc-border) bg-(--tc-surface) text-(--tc-text-primary) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/30 focus:border-(--tc-accent)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function EditTextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm text-(--tc-text-primary)">
      {label}
      <textarea
        className="mt-1 w-full px-3 py-2 border rounded-lg border-(--tc-border) bg-(--tc-surface) text-(--tc-text-primary) focus:outline-none focus:ring-2 focus:ring-(--tc-accent)/30 focus:border-(--tc-accent)"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

type CompanyUsersProps = {
  clientId: string;
  onAddUser: () => void;
  disabled?: boolean;
};

function CompanyUsers({ clientId, onAddUser, disabled = false }: CompanyUsersProps) {
  const router = useRouter();
  const [users, setUsers] = useState<Array<{ id: string; name: string; job_title?: string | null; role?: string | null; avatar_url?: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"view" | "edit">("view");

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/users?client_id=${clientId}`, { credentials: "include", cache: "no-store" });
        if (res.status === 401) {
          toast.error("SessÃ£o expirada. FaÃ§a login novamente.");
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
    };
    fetchUsers();
  }, [clientId, router]);

  useEffect(() => {
    if (disabled && mode === "edit") {
      setMode("view");
    }
  }, [disabled, mode]);

  return (
    <div className="space-y-2">
      {loading && <p className="text-sm text-gray-500">Carregando pessoas...</p>}
      {!loading && users.length === 0 && <p className="text-sm text-gray-500">Nenhum responsavel vinculado.</p>}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-(--tc-text-muted)">Modo</span>
        <button
          type="button"
          className={`rounded px-2 py-1 border text-xs ${mode === "view" ? "border-indigo-300 text-indigo-700" : "border-(--tc-border) text-(--tc-text-muted)"} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          disabled={disabled}
          onClick={() => !disabled && setMode("view")}
        >
          Visualizar
        </button>
        <button
          type="button"
          className={`rounded px-2 py-1 border text-xs ${mode === "edit" ? "border-indigo-300 text-indigo-700" : "border-(--tc-border) text-(--tc-text-muted)"} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setMode("edit");
            onAddUser();
          }}
        >
          Editar / Adicionar
        </button>
      </div>
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between rounded-lg border border-(--tc-border) px-3 py-2">
            <div className="flex items-center gap-2">
              {u.avatar_url ? (
                <Image src={u.avatar_url} alt={u.name} width={32} height={32} className="rounded-full object-cover" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-(--tc-surface-2) flex items-center justify-center text-xs text-(--tc-text-muted)">
                  {u.name?.slice(0, 1)?.toUpperCase() ?? "U"}
                </div>
              )}
              <div>
                <div className="text-sm font-medium">{u.name}</div>
                <div className="text-xs text-(--tc-text-muted)">{u.job_title ?? u.role ?? "Membro"}</div>
              </div>
            </div>
            {mode === "edit" && (
              <button
                className={`text-xs font-semibold ${disabled ? "text-gray-400 cursor-not-allowed" : "text-indigo-700 hover:underline"}`}
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  onAddUser();
                }}
              >
                Editar usuario
              </button>
            )}
          </div>
        ))}
      </div>
      {mode === "edit" && (
        <button
          className={`mt-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:border-indigo-300 dark:border-indigo-400/40 dark:bg-indigo-500/15 dark:text-indigo-200 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            onAddUser();
          }}
        >
          Adicionar responsavel
        </button>
      )}
    </div>
  );
}




