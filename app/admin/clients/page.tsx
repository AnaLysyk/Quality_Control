"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { CreateClientModal, type ClientFormValues } from "@/clients/components/CreateClientModal";
import { CreateUserModal } from "@/admin/users/components/CreateUserModal";
import { useAuthUser } from "@/hooks/useAuthUser";
import { getAccessToken } from "@/lib/api";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";
import Image from "next/image";
import { FiEdit2, FiExternalLink, FiUsers, FiX, FiCheckCircle, FiXCircle } from "react-icons/fi";

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
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function mapClient(row: any): Client {
  return {
    id: row.id,
    name: row.name ?? row.company_name ?? "",
    slug: row.slug ?? null,
    taxId: row.tax_id ?? null,
    address: row.address ?? null,
    description: row.description ?? null,
    website: row.website ?? null,
    phone: row.phone ?? null,
    logoUrl: row.logo_url ?? null,
    docsLink: row.docs_link ?? null,
    notes: row.notes ?? null,
    active: row.active ?? false,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function AdminClientsPage() {
  const { user } = useAuthUser();
  const isGlobalAdmin = !!user?.isGlobalAdmin || (user as any)?.is_global_admin === true;

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
  const [userList, setUserList] = useState<
    Array<{ id: string; name: string; email?: string; job_title?: string | null; role?: string | null; client_id?: string | null; avatar_url?: string | null; active?: boolean }>
  >([]);
  const [userLoading, setUserLoading] = useState(false);

  const selected = useMemo(() => items.find((c) => c.id === selectedId) ?? null, [items, selectedId]);
  const currentActive = form.active ?? selected?.active ?? false;
  const isInactive = !currentActive;
  const resetForm = () => {
    if (selected) setForm(selected);
  };

  async function load() {
    setLoading(true);
    setMessage(null);
    try {
      const token = await getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch("/api/clients", { cache: "no-store", headers, credentials: "include" });
      if (res.status === 403) {
        setMessage("Acesso negado: use uma conta de admin global.");
        setItems([]);
        return;
      }
      const json = await res.json().catch(() => ({}));
      const data = Array.isArray(json.items) ? json.items : [];
      setItems(data.map(mapClient));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar clientes";
      setMessage(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function openModal(id: string) {
    setSelectedId(id);
    setUserClientId(id);
    setIsEditing(false);
    setMessage(null);
    try {
      const token = await getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`/api/clients/${id}`, { cache: "no-store", headers, credentials: "include" });
      if (!res.ok) {
        const fallback = items.find((c) => c.id === id);
        if (fallback) {
          setForm(fallback);
          return;
        }
        setMessage("Nao foi possivel carregar o cliente selecionado");
        return;
      }
      const json = await res.json();
      setForm(mapClient(json));
      await fetchUsers(id);
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
      };
      const res = await fetch(`/api/clients/${selectedId}`, {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(err.message || "Erro ao salvar cliente");
        return;
      }
      const updated = await res.json().catch(() => null);
      if (updated) {
        setItems((prev) => prev.map((c) => (c.id === selectedId ? mapClient(updated) : c)));
      }
      closeModal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar cliente";
      setMessage(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateClient(data: ClientFormValues) {
    try {
      const token = await getAccessToken();
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
      };
      const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const res = await fetch("/api/clients", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(err.message || "Erro ao criar cliente");
        return null;
      }
      const created = await res.json().catch(() => null);
      if (created) {
        setItems((prev) => [mapClient(created), ...prev]);
        setUserClientId(created.id);
        await fetchUsers(created.id);
        return created;
      }
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar cliente";
      setMessage(msg);
      return null;
    }
  }

  useEffect(() => {
    load();
  }, []);

  const fetchUsers = async (clientId: string | null) => {
    if (!clientId) {
      setUserList([]);
      return;
    }
    setUserLoading(true);
    try {
      const res = await fetch(`/api/admin/users?client_id=${clientId}`, { credentials: "include" });
      const json = await res.json().catch(() => ({ items: [] }));
      setUserList(Array.isArray(json.items) ? json.items : []);
    } catch {
      setUserList([]);
    } finally {
      setUserLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#0b1a3c] px-6 py-10 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Empresas</h1>
          <p className="text-sm text-gray-600">Gerencie clientes e usuarios</p>
        </div>
        <div className="flex items-center gap-2">
          {isGlobalAdmin && (
            <button
              onClick={() => setOpenCreate(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              + Cadastrar empresa
            </button>
          )}
          {isGlobalAdmin && (
            <a
              href="/admin/users"
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:border-indigo-300"
            >
              Gerenciar usuarios
            </a>
          )}
          <button onClick={load} className="rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm" disabled={loading}>
            Atualizar
          </button>
        </div>
      </div>

      {message && <p className="text-sm text-red-600">{message}</p>}
      {loading && <p className="text-sm text-gray-600">Carregando...</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((client) => (
          <button
            key={client.id}
            onClick={() => openModal(client.id)}
            className="w-full text-left rounded-lg border border-[#e5e7eb] p-4 bg-white hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded bg-gray-100 overflow-hidden flex items-center justify-center">
                {client.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={client.logoUrl} alt={client.name} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xs text-gray-500">Sem logo</span>
                )}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{client.name}</div>
                <div className="text-xs">{client.active ? "Ativo" : "Inativo"}</div>
                {client.taxId && <div className="text-xs text-gray-500">{client.taxId}</div>}
                {client.website && (
                  <div className="text-xs text-indigo-600 truncate">{client.website}</div>
                )}
                {client.createdAt && (
                  <div className="text-[11px] text-gray-500">
                    Criado em {new Date(client.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
        {items.length === 0 && !loading && (
          <div className="text-sm text-gray-600">
            {isGlobalAdmin ? (
              <div className="mt-2 rounded-xl border border-dashed border-gray-300 p-4 text-center">
                <p className="text-sm text-gray-700">Voce ainda nao criou nenhum cliente.</p>
                <button
                  onClick={() => setOpenCreate(true)}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white shadow-sm hover:bg-indigo-500"
                >
                  + Cadastrar instituicao ou empresa
                </button>
              </div>
            ) : (
              <p>Nenhum cliente encontrado.</p>
            )}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 py-6 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-6 md:p-7 space-y-6 max-h-[calc(100vh-96px)] overflow-y-auto border border-[#e5e7eb]">
            {/* Header */}
            <div className="rounded-2xl bg-gradient-to-r from-[#0b1e3c] via-[#0f274d] to-[#0b1e3c] text-white p-5 relative overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-white/80">Painel da empresa</p>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shadow-inner">
                      {form.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={form.logoUrl as string} alt={form.name || selected.name} className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-xs text-white/80">Logo</span>
                      )}
                    </div>
                    <div className="min-w-[180px]">
                      <h2 className="text-2xl font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] leading-tight">
                        {(form.name && form.name.trim()) || selected.name}
                      </h2>
                      {form.slug || selected.slug ? (
                        <p className="text-xs text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
                          slug: {form.slug || selected.slug}
                        </p>
                      ) : null}
                    </div>
                    <button
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
            <div className="flex items-center gap-3 border-b border-[var(--tc-border)] pb-2">
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
                  <InfoCard label="Notas" value={form.notes ?? selected.notes} full />
                  <InfoCard label="Descricao" value={form.description ?? selected.description} full />
                </div>

                {isEditing && (
                  <div className="rounded-xl border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-4 space-y-3">
                    <EditField label="Nome" value={form.name ?? ""} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
                    <EditField label="CNPJ" value={form.taxId ?? ""} onChange={(v) => setForm((f) => ({ ...f, taxId: v }))} />
                    <EditField label="CEP / Endereco" value={form.address ?? ""} onChange={(v) => setForm((f) => ({ ...f, address: v }))} />
                    <EditField label="Telefone" value={form.phone ?? ""} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
                    <EditField label="Website" value={form.website ?? ""} onChange={(v) => setForm((f) => ({ ...f, website: v }))} />
                    <EditField label="LinkedIn / Docs" value={form.docsLink ?? ""} onChange={(v) => setForm((f) => ({ ...f, docsLink: v }))} />
                    <EditTextArea label="Descricao" value={form.description ?? ""} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
                    <EditTextArea label="Notas" value={form.notes ?? ""} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} />
                  </div>
                )}
              </div>
            )}

            {activeTab === "pessoas" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[var(--tc-text-primary)]">Pessoas desta empresa</h3>
                  <button
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
                    className="px-3 py-2 rounded-lg border border-[#e5e7eb] disabled:opacity-60"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Limpar
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-[#e53935] text-white font-semibold shadow disabled:opacity-60"
                    onClick={save}
                    disabled={saving}
                  >
                    Salvar dados
                  </button>
                </>
              ) : (
                <button
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
          fetchUsers(id);
          setOpenUserModal(true);
        }}
      />
      <CreateUserModal
        open={openUserModal}
        clientId={userClientId}
        clients={items.map((c) => ({ id: c.id, name: c.name }))}
        onClose={() => setOpenUserModal(false)}
        onCreated={async () => {
          await fetchUsers(userClientId);
          load();
        }}
        users={userList}
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
      className="p-2 rounded-lg border border-white/30 bg-white/10 text-white hover:border-white/60 transition disabled:opacity-50"
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
      onClick={onClick}
      className={`px-3 py-2 text-sm font-semibold border-b-2 transition ${
        active
          ? "text-[var(--tc-text-primary)] border-[var(--tc-accent)]"
          : "text-[var(--tc-text-muted)] border-transparent hover:text-[var(--tc-text-primary)]"
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
      className="text-[var(--tc-accent)] font-semibold hover:underline break-all"
    >
      {value}
    </a>
  ) : (
    <p className="text-[var(--tc-text-primary)]">{value}</p>
  );
  return (
    <div className={`rounded-xl border border-[var(--tc-border)] bg-[var(--tc-surface)] p-3 ${full ? "md:col-span-2" : ""}`}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--tc-text-muted)]">{label}</p>
      {content}
    </div>
  );
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm text-[var(--tc-text-primary)]">
      {label}
      <input
        className="mt-1 w-full px-3 py-2 border rounded-lg border-[var(--tc-border)] bg-[var(--tc-surface)] text-[var(--tc-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--tc-accent)]/30 focus:border-[var(--tc-accent)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function EditTextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm text-[var(--tc-text-primary)]">
      {label}
      <textarea
        className="mt-1 w-full px-3 py-2 border rounded-lg border-[var(--tc-border)] bg-[var(--tc-surface)] text-[var(--tc-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--tc-accent)]/30 focus:border-[var(--tc-accent)]"
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
  const [users, setUsers] = useState<Array<{ id: string; name: string; job_title?: string | null; role?: string | null; avatar_url?: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"view" | "edit">("view");

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/users?client_id=${clientId}`, { credentials: "include" });
        const json = await res.json().catch(() => ({ items: [] }));
        setUsers(Array.isArray(json.items) ? json.items : []);
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [clientId]);

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
        <span className="text-[var(--tc-text-muted)]">Modo</span>
        <button
          className={`rounded px-2 py-1 border text-xs ${mode === "view" ? "border-indigo-300 text-indigo-700" : "border-[var(--tc-border)] text-[var(--tc-text-muted)]"} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          disabled={disabled}
          onClick={() => !disabled && setMode("view")}
        >
          Visualizar
        </button>
        <button
          className={`rounded px-2 py-1 border text-xs ${mode === "edit" ? "border-indigo-300 text-indigo-700" : "border-[var(--tc-border)] text-[var(--tc-text-muted)]"} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
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
          <div key={u.id} className="flex items-center justify-between rounded-lg border border-[var(--tc-border)] px-3 py-2">
            <div className="flex items-center gap-2">
              {u.avatar_url ? (
                <Image src={u.avatar_url} alt={u.name} width={32} height={32} className="rounded-full object-cover" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-[var(--tc-surface-2)] flex items-center justify-center text-xs text-[var(--tc-text-muted)]">
                  {u.name?.slice(0, 1)?.toUpperCase() ?? "U"}
                </div>
              )}
              <div>
                <div className="text-sm font-medium">{u.name}</div>
                <div className="text-xs text-[var(--tc-text-muted)]">{u.job_title ?? u.role ?? "Membro"}</div>
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

function InfoRow({ label, value, isLink }: { label: string; value?: string | null; isLink?: boolean }) {
  if (!value) return null;
  const content = isLink ? (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      className="text-[var(--tc-accent,#4e8df5)] hover:underline break-all"
    >
      {value}
    </a>
  ) : (
    <span className="text-[var(--tc-text-secondary,#4B5563)]">{value}</span>
  );
  return (
    <div className="flex flex-col text-sm">
      <span className="text-[var(--tc-text-muted,#6B7280)] text-xs">{label}</span>
      {content}
    </div>
  );
}
