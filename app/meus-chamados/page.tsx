
import React from "react";
"use client";

function getSuporteCode(code: string | null | undefined, id: string): string {
  const raw = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (raw && raw.startsWith("SP-")) {
    const match = raw.match(/^SP-(\d{4,})$/i);
    if (match) return raw;
  }
  return `SP-${id.slice(0, 6).toUpperCase()}`;
}

import { useCallback, useMemo, useState } from "react";
import { useSWRSupports } from "./useSWRSupports";
import { FiLifeBuoy, FiPlus, FiRefreshCw, FiX } from "react-icons/fi";
import { usePermissionAccess } from "@/hooks/usePermissionAccess";
import { useSuporteKanbanColumns } from "@/hooks/useSuporteKanbanColumns";
import { getSuporteStatusLabel, SUPORTE_STATUS_OPTIONS, normalizeKanbanStatus, type SuporteStatus } from "@/lib/suportesStatus";
import SuporteDetailsModal from "@/components/SuporteDetailsModal";

type SuporteItem = {
  id: string;
  title: string;
  description: string;
  status: SuporteStatus;
  type?: string | null;
  code?: string | null;
  priority?: string | null;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  companySlug?: string | null;
  companyId?: string | null;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
};

type ColumnKey = string;

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];

const TYPE_OPTIONS = [
  { value: "bug", label: "Bug" },
  { value: "melhoria", label: "Melhoria" },
  { value: "tarefa", label: "Tarefa" },
];

function isDevRole(role: string | null | undefined) {
  const value = (role ?? "").toLowerCase();
  return (
    value === "it_dev" ||
    value === "itdev" ||
    value === "developer" ||
    value === "dev"
  );
}

function shortText(value?: string | null, max = 120) {
  if (!value) return "Sem descricao.";
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 3))}...`;
}

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "-";
  return new Date(time).toLocaleDateString("pt-BR");
}
export default function MeusSuportesPage() {
  const { user, loading, can } = usePermissionAccess();
  const canViewSupport = can("support", "view") || can("tickets", "view");
  const canCreateSupport = can("support", "create") || can("tickets", "create");
  const canMoveSupport = isDevRole(user?.role) || can("support", "status") || can("tickets", "status");
  const [suportes, setSuportes] = useState<SuporteItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { supports, loading: loadingSuportes, error: swrError, refetch } = useSWRSupports();
  // Sincroniza estado local com SWR
  useEffect(() => {
    setSuportes(supports);
  }, [supports]);
  useEffect(() => {
    setError(swrError ? (swrError.message || String(swrError)) : null);
  }, [swrError]);
  const [selectedSuporte, setSelectedSuporte] = useState<SuporteItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    title: "",
    description: "",
    type: "tarefa",
    priority: "medium",
  });
  // Cards horizontais, sem colunas, drag ou statusOptions
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSaving, setCreateSaving] = useState(false);

  // Função para recarregar suportes
  // reloadSuportes agora apenas chama refetch do SWR
  const reloadSuportes = useCallback(async () => {
    await refetch();
  }, [refetch]);

  async function handleCreateSuporte() {
    if (!createDraft.title.trim()) return;
    setCreateSaving(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/suportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: createDraft.title.trim(),
          description: createDraft.description.trim(),
          type: createDraft.type,
          priority: createDraft.priority,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Erro ao criar suporte");
      }
      setCreateOpen(false);
      setCreateDraft({ title: "", description: "", type: "tarefa", priority: "medium" });
      setCreateSaving(false);
      // Atualiza lista sem reload
      await reloadSuportes();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Erro ao criar suporte");
      setCreateSaving(false);
    }
  }

  async function updateStatus(suporteId: string, nextStatus: SuporteStatus) {
    const previous = suportes;
    setSuportes((current) =>
      current.map((suporte) => (suporte.id === suporteId ? { ...suporte, status: nextStatus } : suporte)),
    );
    try {
      const res = await fetch(`/api/suportes/${suporteId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = (await res.json().catch(() => ({}))) as { item?: SuporteItem; error?: string };
      if (!res.ok || !json.item) {
        setSuportes(previous);
        setError(json?.error || "Falha ao atualizar status");
        return;
      }
      setSuportes((current) =>
        current.map((suporte) => (suporte.id === json.item?.id ? json.item : suporte)),
      );
    } catch {
      setSuportes(previous);
      setError("Falha ao atualizar status");
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Carregando...</div>;
  }

  if (!user || !canViewSupport) {
    return <div className="p-6 text-sm text-(--tc-text-muted,#6b7280)">Acesso restrito.</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 min-h-[80vh] bg-(--page-bg)">
      <header className="flex flex-col sm:flex-row flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Suportes</h1>
          <p className="text-sm text-(--tc-text-muted,#6b7280)">
            Acompanhe seus suportes e converse com o time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreateSupport && (
            <button
              type="button"
              aria-label="Criar suporte"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-(--tc-accent,#ef0001) px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
            >
              <FiPlus size={14} /> Suporte
            </button>
          )}
        </div>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loadingSuportes && <p className="text-sm text-(--tc-text-muted,#6b7280)">Carregando...</p>}


      {/* Responsivo: grid em telas médias/grandes, carrossel horizontal em mobile */}
      <div className="w-full py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {suportes.map((suporte) => (
            <div
              key={suporte.id}
              className="w-80 shrink-0 rounded-3xl border-2 border-(--tc-border,#e5e7eb) shadow-[0_8px_32px_rgba(15,23,42,0.10)] p-5 min-h-80 flex flex-col bg-(--tc-surface,#f9fafb) transition hover:shadow-[0_16px_48px_rgba(15,23,42,0.13)]"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-bold uppercase tracking-[0.25em] text-(--tc-accent,#ef0001)">
                  {getSuporteCode(suporte.code, suporte.id)}
                </p>
                <span className="text-[13px] uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                  {getSuporteStatusLabel(normalizeKanbanStatus(suporte.status), [])}
                </span>
                <button
                  type="button"
                  className="ml-2 rounded-full border border-(--tc-accent,#ef0001) px-2 py-1 text-xs font-semibold uppercase tracking-[0.2em] bg-(--tc-accent,#ef0001) text-white hover:bg-(--tc-accent-dark,#c20000)"
                  aria-label={`Abrir detalhes do suporte ${suporte.title}`}
                  title="Abrir detalhes"
                  onClick={() => setSelectedSuporte(suporte)}
                >
                  Detalhes
                </button>
              </div>
              <p className="mt-2 text-lg font-semibold wrap-break-word">{suporte.title || 'Sem titulo'}</p>
              <p className="mt-1 text-[14px] text-(--tc-text-muted,#6b7280) wrap-break-word">{shortText(suporte.description, 100)}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.25em] text-(--tc-text-muted,#6b7280)">
                <span className="bg-(--tc-accent,#ef0001)/10 px-2 py-1 rounded">Tipo: {suporte.type || 'tarefa'}</span>
                <span className="bg-(--tc-accent,#ef0001)/10 px-2 py-1 rounded">Prioridade: {suporte.priority || 'medium'}</span>
              </div>
              <div className="mt-2 text-[11px] text-(--tc-text-muted,#6b7280) space-y-1">
                <p>Criador: <span className="font-semibold text-(--tc-accent,#ef0001)">{suporte.createdByName || suporte.createdByEmail || suporte.createdBy || '-'}</span></p>
                <p>Criado: <span className="font-semibold">{formatDate(suporte.createdAt)}</span></p>
                <p>Atualizado: <span className="font-semibold">{formatDate(suporte.updatedAt)}</span></p>
              </div>
              <div className="mt-3">
                <label className="sr-only" htmlFor={`status-${suporte.id}`}>Status</label>
                <select
                  id={`status-${suporte.id}`}
                  aria-label="Status do suporte"
                  title="Status do suporte"
                  className="w-full rounded-lg border-2 border-(--tc-accent,#ef0001) bg-(--tc-surface,#f9fafb) px-2 py-1 text-[11px] text-(--tc-accent,#ef0001) font-bold cursor-not-allowed"
                  value={normalizeKanbanStatus(suporte.status)}
                  disabled
                  tabIndex={-1}
                >
                  <option value={normalizeKanbanStatus(suporte.status)}>{getSuporteStatusLabel(normalizeKanbanStatus(suporte.status), [])}</option>
                </select>
                <p className="mt-2 text-xs font-semibold text-(--tc-accent,#ef0001) bg-(--tc-accent,#ef0001)/10 rounded px-2 py-1 border border-(--tc-accent,#ef0001)">Você não tem permissão para mover o suporte</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <SuporteDetailsModal
        key={selectedSuporte?.id || 'empty'}
        open={Boolean(selectedSuporte)}
        suporte={selectedSuporte}
        onClose={() => setSelectedSuporte(null)}
        canEditStatus={canMoveSupport}
        statusOptions={[]}
        onSuporteUpdated={(updated: SuporteItem) => {
          setSelectedSuporte(updated);
          setSuportes((current) =>
            current.map((suporte) => (suporte.id === updated.id ? updated : suporte)),
          );
        }}
      />

      {createOpen && (
        <div
          className="ticket-detail-modal-overlay support-create-modal-overlay"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="support-create-modal-shell"
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-create-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="support-create-modal-header">
              <div className="support-create-modal-heading">
                <span className="support-create-modal-icon">
                  <FiLifeBuoy size={18} />
                </span>
                <div className="support-create-modal-heading-copy">
                  <p className="support-create-modal-kicker">SUPORTE</p>
                  <h2 id="support-create-modal-title" className="support-create-modal-title">
                    Novo suporte
                  </h2>
                  <p className="support-create-modal-subtitle">
                    Abra um chamado com titulo, descricao, tipo e prioridade.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="support-create-modal-close"
                aria-label="Fechar modal de novo suporte"
                title="Fechar"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="support-create-modal-body">
              <div className="support-create-modal-form">
                <label className="support-create-modal-field" htmlFor="my-create-suporte-title">
                  <span className="support-create-modal-label">Titulo</span>
                  <input
                    id="my-create-suporte-title"
                    className="support-create-modal-input"
                    placeholder="Digite o titulo do suporte"
                    value={createDraft.title}
                    onChange={(e) => setCreateDraft((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </label>

                <label className="support-create-modal-field" htmlFor="my-create-suporte-description">
                  <span className="support-create-modal-label">Descricao</span>
                  <textarea
                    id="my-create-suporte-description"
                    rows={5}
                    className="support-create-modal-textarea"
                    placeholder="Descreva o suporte..."
                    value={createDraft.description}
                    onChange={(e) => setCreateDraft((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </label>

                <div className="support-create-modal-select-grid">
                  <label className="support-create-modal-field" htmlFor="my-create-suporte-type">
                    <span className="support-create-modal-label">Tipo</span>
                    <select
                      id="my-create-suporte-type"
                      className="support-create-modal-select"
                      title="Tipo do suporte"
                      aria-label="Tipo do suporte"
                      value={createDraft.type}
                      onChange={(e) => setCreateDraft((prev) => ({ ...prev, type: e.target.value }))}
                    >
                      {TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="support-create-modal-field" htmlFor="my-create-suporte-priority">
                    <span className="support-create-modal-label">Prioridade</span>
                    <select
                      id="my-create-suporte-priority"
                      className="support-create-modal-select"
                      title="Prioridade do suporte"
                      aria-label="Prioridade do suporte"
                      value={createDraft.priority}
                      onChange={(e) => setCreateDraft((prev) => ({ ...prev, priority: e.target.value }))}
                    >
                      {PRIORITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {createError && <p className="support-create-modal-error">{createError}</p>}
              </div>
            </div>

            <div className="support-create-modal-footer">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="support-create-modal-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateSuporte}
                disabled={createSaving || !createDraft.title.trim()}
                className="support-create-modal-primary"
              >
                <FiPlus size={14} />
                {createSaving ? "Salvando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
