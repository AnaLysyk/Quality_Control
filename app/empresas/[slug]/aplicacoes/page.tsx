"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FiEdit2, FiImage, FiPackage, FiPlus, FiSave, FiX } from "react-icons/fi";
import { fetchApi } from "@/lib/api";

type AppItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  qaseProjectCode?: string | null;
  source?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

function resolveSourceMeta(app: AppItem) {
  const source = String(app.source ?? "").trim().toLowerCase();
  if (source === "qase" && app.qaseProjectCode) {
    return {
      label: `Qase: ${app.qaseProjectCode}`,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (source === "jira") {
    return {
      label: "Jira",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  return {
    label: "Manual",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  };
}

export default function CompanyAppsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createImageUrl, setCreateImageUrl] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let canceled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchApi(`/api/applications?companySlug=${encodeURIComponent(slug)}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error("Erro ao carregar aplicacoes");
        if (!canceled) setApps(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!canceled) setError("Erro ao carregar aplicacoes da empresa.");
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    void load();
    return () => {
      canceled = true;
    };
  }, [slug]);

  function startEdit(app: AppItem) {
    setEditingId(app.id);
    setEditName(app.name);
    setEditDescription(app.description ?? "");
    setEditImageUrl(app.imageUrl ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
    setEditImageUrl("");
  }

  function resetCreateForm() {
    setCreateName("");
    setCreateDescription("");
    setCreateImageUrl("");
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetchApi(`/api/applications/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim() || undefined,
          description: editDescription.trim() || null,
          imageUrl: editImageUrl.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      const data = await res.json().catch(() => null);
      if (data?.item) {
        setApps((prev) => prev.map((item) => (item.id === id ? { ...item, ...data.item } : item)));
      }
      cancelEdit();
    } catch {
      setError("Erro ao atualizar a aplicacao.");
    } finally {
      setSaving(false);
    }
  }

  async function createManualApplication() {
    if (!slug) return;
    if (!createName.trim()) {
      setError("Informe o nome da aplicacao manual.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const response = await fetchApi("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug: slug,
          name: createName.trim(),
          description: createDescription.trim() || null,
          source: "manual",
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.item) {
        throw new Error("Erro ao criar aplicacao");
      }

      const created = payload.item as AppItem;
      setApps((prev) => [
        {
          ...created,
          imageUrl: createImageUrl.trim() || created.imageUrl || null,
        },
        ...prev,
      ]);

      if (createImageUrl.trim()) {
        await fetchApi(`/api/applications/${encodeURIComponent(created.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: createImageUrl.trim() }),
        }).catch(() => undefined);
      }

      resetCreateForm();
    } catch {
      setError("Erro ao criar a aplicacao manual.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-(--page-bg,#f5f6fa) px-4 py-8 text-(--page-text,#0b1a3c) sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-(--tc-accent,#ef0001)">Aplicacoes</p>
          <h1 className="mt-2 text-3xl font-extrabold">Aplicacoes da empresa {slug}</h1>
          <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
            Gerencie nome, descricao e imagem de cada aplicacao monitorada pelo Quality Control.
          </p>
        </header>

        <section className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-(--tc-accent,#ef0001)">Nova aplicacao</p>
          <h2 className="mt-2 text-xl font-extrabold text-(--tc-text,#0b1a3c)">Criar aplicacao manual</h2>
          <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
            As aplicacoes criadas aqui convivem com as integradas do Qase na mesma lista e podem ser usadas na criacao de runs.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block text-xs font-semibold text-(--tc-text-muted,#6b7280)">
              Nome
              <input
                className="mt-1 w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text,#0b1a3c) outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="Nome da aplicacao"
              />
            </label>

            <label className="block text-xs font-semibold text-(--tc-text-muted,#6b7280)">
              URL da imagem
              <input
                className="mt-1 w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text,#0b1a3c) outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)"
                value={createImageUrl}
                onChange={(event) => setCreateImageUrl(event.target.value)}
                placeholder="https://cdn.../app-logo.png"
              />
            </label>
          </div>

          <label className="mt-4 block text-xs font-semibold text-(--tc-text-muted,#6b7280)">
            Descricao
            <textarea
              className="mt-1 w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text,#0b1a3c) outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)"
              value={createDescription}
              onChange={(event) => setCreateDescription(event.target.value)}
              rows={2}
              placeholder="Descricao da aplicacao"
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={creating}
              onClick={() => void createManualApplication()}
              className="inline-flex items-center gap-2 rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              <FiPlus size={14} />
              {creating ? "Criando..." : "Criar aplicacao manual"}
            </button>
            <button
              type="button"
              onClick={resetCreateForm}
              className="inline-flex items-center gap-2 rounded-lg border border-(--tc-border,#e5e7eb) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:bg-(--tc-surface-2,#f3f4f6)"
            >
              <FiX size={14} />
              Limpar
            </button>
          </div>
        </section>

        {error ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
            <button type="button" className="ml-2 font-semibold underline" onClick={() => setError(null)}>
              Fechar
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl bg-white p-8 text-center text-sm text-(--tc-text-muted,#6b7280) shadow-sm">
            Carregando aplicacoes...
          </div>
        ) : apps.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <FiPackage size={32} className="mx-auto text-(--tc-text-muted,#6b7280)" />
            <p className="mt-3 text-sm text-(--tc-text-muted,#6b7280)">
              Nenhuma aplicacao encontrada para esta empresa. Cadastre projetos da Qase no formulario de empresa ou crie manualmente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {apps.map((app) => {
              const sourceMeta = resolveSourceMeta(app);
              return (
                <div
                  key={app.id}
                  className="rounded-3xl border border-(--tc-border,#e5e7eb) bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  {editingId === app.id ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        {editImageUrl ? (
                          <img
                            src={editImageUrl}
                            alt={editName}
                            className="h-14 w-14 shrink-0 rounded-2xl border border-(--tc-border,#e5e7eb) object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-(--tc-surface-2,#f3f4f6) text-(--tc-text-muted,#6b7280)">
                            <FiImage size={20} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <label className="block text-xs font-semibold text-(--tc-text-muted,#6b7280)">
                            Nome
                            <input
                              className="mt-1 w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text,#0b1a3c) outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)"
                              value={editName}
                              onChange={(event) => setEditName(event.target.value)}
                              placeholder="Nome da aplicacao"
                            />
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-(--tc-text-muted,#6b7280)">URL da imagem</label>
                        <input
                          className="mt-1 w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text,#0b1a3c) outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)"
                          value={editImageUrl}
                          onChange={(event) => setEditImageUrl(event.target.value)}
                          placeholder="https://cdn.../app-logo.png"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-(--tc-text-muted,#6b7280)">Descricao</label>
                        <textarea
                          className="mt-1 w-full rounded-lg border border-(--tc-border,#e5e7eb) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text,#0b1a3c) outline-none focus:ring-2 focus:ring-(--tc-accent,#ef0001)"
                          value={editDescription}
                          onChange={(event) => setEditDescription(event.target.value)}
                          rows={2}
                          placeholder="Descricao da aplicacao"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void saveEdit(app.id)}
                          className="inline-flex items-center gap-2 rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                        >
                          <FiSave size={14} />
                          {saving ? "Salvando..." : "Salvar"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="inline-flex items-center gap-2 rounded-lg border border-(--tc-border,#e5e7eb) px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:bg-(--tc-surface-2,#f3f4f6)"
                        >
                          <FiX size={14} />
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      {app.imageUrl ? (
                        <img
                          src={app.imageUrl}
                          alt={app.name}
                          className="h-14 w-14 shrink-0 rounded-2xl border border-(--tc-border,#e5e7eb) object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-(--tc-surface-2,#f3f4f6) text-(--tc-text-muted,#6b7280)">
                          <FiPackage size={20} />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-(--tc-text,#0b1a3c)">{app.name}</h3>
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${sourceMeta.className}`}>
                            {sourceMeta.label}
                          </span>
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${app.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}>
                            {app.active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        {app.description ? (
                          <p className="mt-1 text-sm text-(--tc-text-muted,#6b7280)">{app.description}</p>
                        ) : null}
                        <p className="mt-2 text-xs text-(--tc-text-muted,#6b7280)">
                          Slug: {app.slug} | Criado em {new Date(app.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => startEdit(app)}
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-(--tc-border,#e5e7eb) px-3 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c) transition hover:border-(--tc-accent,#ef0001) hover:text-(--tc-accent,#ef0001)"
                      >
                        <FiEdit2 size={14} />
                        Editar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
