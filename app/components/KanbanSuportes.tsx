"use client";

import React, { useEffect, useState } from "react";
import { useClientContext } from "@/context/ClientContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import SuporteDetailsModal from "@/components/SuporteDetailsModal";

interface KanbanColumn {
  id: string;
  name: string;
}

const initialColumns: KanbanColumn[] = [
  { id: "backlog", name: "Backlog" },
  { id: "doing", name: "Em Progresso" },
  { id: "review", name: "Em Revisão" },
  { id: "done", name: "Concluído" },
];

export default function KanbanSuportes() {
  const { activeClientSlug } = useClientContext();
  const [columns, setColumns] = useState<KanbanColumn[]>(initialColumns);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSuporte, setSelectedSuporte] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { user } = useAuthUser();

  // Load suportes from API for the active company when available
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!activeClientSlug) return;
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ companySlug: activeClientSlug });
        // If the user is an admin or dev, request the full company scope
        const normalizedRole = typeof user?.role === "string" ? user.role.toLowerCase() : null;
        const isAdminLike = user?.isGlobalAdmin === true || normalizedRole === "admin" || normalizedRole === "global_admin" || normalizedRole === "it_dev" || normalizedRole === "itdev" || normalizedRole === "dev";
        if (isAdminLike) qs.set("scope", "all");
        const res = await fetch(`/api/suportes?${qs.toString()}`, { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 204) {
            if (mounted) setItems([]);
            return;
          }
          throw new Error(`Erro ${res.status}`);
        }
        const data = await res.json();
        // API returns { items: [...] } or an array directly depending on compatibility wrapper
        const itemsFromApi = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        if (mounted) setItems(itemsFromApi);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [activeClientSlug, user]);

  // Renomear coluna
  const handleRename = (id: string, name: string) => {
    setColumns((cols) => cols.map((col) => (col.id === id ? { ...col, name } : col)));
  };

  // Remover coluna
  const handleRemove = (id: string) => {
    setColumns((cols) => cols.filter((col) => col.id !== id));
  };

  // Adicionar coluna
  const handleAdd = () => {
    const newId = `col-${Date.now()}`;
    setColumns((cols) => [...cols, { id: newId, name: "Nova coluna" }]);
  };

  const canDelete = (item: any) => {
    // Prefer server-derived permissions, but fall back to basic rule: only company items can be deleted locally
    try {
      if (!item) return false;
      if (item.companySlug && activeClientSlug && item.companySlug !== activeClientSlug) return false;
      return true;
    } catch {
      return false;
    }
  };

  const handleDeleteItem = async (id: string) => {
    // optimistic remove locally, attempt server delete
    const prev = items;
    setItems((it) => it.filter((i) => i.id !== id));
    try {
      const res = await fetch(`/api/suportes/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed ${res.status}`);
    } catch (err) {
      // rollback
      setItems(prev);
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex gap-8 overflow-x-auto py-4">
      {loading && <div className="text-sm text-(--tc-text-muted,#6b7280)">Carregando chamados...</div>}
      {error && <div className="text-sm text-red-600" role="alert">{error}</div>}
      {columns.map((col) => (
        <div key={col.id} className="min-w-85 bg-(--page-surface,#fff) border rounded-lg p-4 flex flex-col items-center">
          <label htmlFor={`col-name-${col.id}`} className="sr-only">
            Nome da coluna
          </label>
          <input
            id={`col-name-${col.id}`}
            className="input-tc text-center font-semibold mb-2 w-full"
            value={col.name}
            onChange={(e) => handleRename(col.id, e.target.value)}
            placeholder="Nome da coluna"
            title="Nome da coluna"
            aria-label="Nome da coluna"
          />
          <div className="w-full space-y-2">
              {items
                .filter((it) => (it.status || "todo") === col.id)
                .map((it) => (
                  <div key={it.id} className="p-2 border rounded bg-(--tc-surface,#fff) flex justify-between items-start">
                    <button
                      className="text-sm text-left flex-1"
                      onClick={() => {
                        setSelectedSuporte(it);
                        setModalOpen(true);
                      }}
                      aria-label={`Abrir chamado ${it.title || it.code || it.id}`}
                    >
                      {it.title || it.subject || `#${it.code ?? it.id}`}
                    </button>
                    <div className="ml-2 flex items-center gap-2">
                      {canDelete(it) && (
                        <button
                          className="text-xs text-red-600"
                          onClick={() => handleDeleteItem(it.id)}
                          aria-label={`Deletar chamado ${it.id}`}
                        >
                          Deletar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
          </div>
          <button className="btn-tc mt-2 w-full" onClick={() => handleRemove(col.id)} disabled={columns.length <= 1}>
            Remover coluna
          </button>
        </div>
      ))}
      <div className="min-w-85 flex flex-col items-center justify-center">
        <button className="btn-tc w-full" onClick={handleAdd}>
          Adicionar coluna
        </button>
      </div>
      {selectedSuporte && (
        <SuporteDetailsModal
          open={modalOpen}
          suporte={selectedSuporte}
          onClose={() => setModalOpen(false)}
          onSuporteUpdated={(updated: any) => {
            // replace item in list
            setItems((prev) => prev.map((it) => (it.id === updated?.id ? { ...it, ...updated } : it)));
            setSelectedSuporte(updated ?? null);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
