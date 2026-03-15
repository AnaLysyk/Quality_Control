"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { isDevRole } from "@/lib/rbac/devAccess";
import { formatTicketStatusLabel, type TicketStatusOption } from "@/lib/ticketsStatus";

export type TicketKanbanColumn = {
  key: string;
  label: string;
  locked?: boolean;
};

const DEFAULT_COLUMNS: TicketKanbanColumn[] = [
  { key: "backlog", label: "Backlog", locked: true },
  { key: "doing", label: "Em andamento", locked: true },
  { key: "review", label: "Em revisao", locked: true },
  { key: "done", label: "Concluido", locked: true },
];

function slugifyKey(input: string) {
  const safe = (input ?? "")
    .toString()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safe;
}

function mergeColumns(
  base: TicketKanbanColumn[],
  extras: string[],
) {
  const seen = new Set<string>();
  const merged: TicketKanbanColumn[] = [];

  base.forEach((col) => {
    if (seen.has(col.key)) return;
    merged.push(col);
    seen.add(col.key);
  });

  extras.forEach((key) => {
    const normalized = slugifyKey(key) || key;
    if (!normalized || seen.has(normalized)) return;
    merged.push({ key: normalized, label: formatTicketStatusLabel(normalized) });
    seen.add(normalized);
  });

  return merged;
}


async function fetchColumnsFromApi(): Promise<TicketKanbanColumn[]> {
  try {
    const res = await fetch("/api/kanban-columns", { cache: "no-store" });
    const json = await res.json();
    if (Array.isArray(json.columns)) return json.columns;
    return DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

async function saveColumnsToApi(columns: TicketKanbanColumn[]): Promise<boolean> {
  try {
    const res = await fetch("/api/kanban-columns", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columns }),
    });
    return res.ok;
  } catch {
    return false;
  }
}


export function useTicketKanbanColumns(extraKeys: string[] = [], canManageColumns?: boolean) {
  const { user } = useAuthUser();
  const isDev = isDevRole(user?.role);
  const canManage = canManageColumns ?? isDev;
  const [columns, setColumns] = useState<TicketKanbanColumn[]>(DEFAULT_COLUMNS);
  const hydratedRef = useRef(false);

  useEffect(() => {
    fetchColumnsFromApi().then((apiCols) => {
      setColumns(apiCols);
      hydratedRef.current = true;
    });
  }, []);

  const mergedColumns = useMemo(
    () => mergeColumns(columns, extraKeys),
    [columns, extraKeys],
  );

  // Salva no backend sempre que columns mudar (após hidratação inicial)
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!canManage) return;
    saveColumnsToApi(columns);
  }, [canManage, columns]);

  const statusOptions = useMemo<TicketStatusOption[]>(
    () => mergedColumns.map((col) => ({ value: col.key, label: col.label })),
    [mergedColumns],
  );

  const addColumn = useCallback(
    (label: string) => {
      if (!canManage) return null;
      const trimmed = (label ?? "").toString().trim();
      if (!trimmed) return null;
      const baseKey = slugifyKey(trimmed) || `col-${Date.now()}`;
      const existing = new Set(mergedColumns.map((col) => col.key));
      let key = baseKey;
      let idx = 2;
      while (existing.has(key)) {
        key = `${baseKey}-${idx}`;
        idx += 1;
      }
      setColumns((prev) => {
        const next = [...prev, { key, label: trimmed }];
        return next;
      });
      return key;
    },
    [canManage, mergedColumns],
  );

  const renameColumn = useCallback((key: string, label: string) => {
    if (!canManage) return;
    const trimmed = (label ?? "").toString().trim();
    if (!trimmed || !key) return;
    setColumns((prev) => {
      const base = prev.some((col) => col.key === key) ? [...prev] : mergeColumns(prev, extraKeys);
      const idx = base.findIndex((col) => col.key === key);
      if (idx === -1) {
        return [...base, { key, label: trimmed }];
      }
      const next = [...base];
      next[idx] = { ...next[idx], label: trimmed };
      return next;
    });
  }, [canManage, extraKeys]);

  const removeColumn = useCallback((key: string) => {
    if (!canManage) return;
    setColumns((prev) => mergeColumns(prev, extraKeys).filter((col) => col.key !== key));
  }, [canManage, extraKeys]);

  const moveColumn = useCallback((fromKey: string, toKey: string) => {
    if (!canManage) return;
    if (!fromKey || !toKey || fromKey === toKey) return;

    setColumns((prev) => {
      const base = mergeColumns(prev, extraKeys);
      const fromIndex = base.findIndex((col) => col.key === fromKey);
      const toIndex = base.findIndex((col) => col.key === toKey);
      if (fromIndex === -1 || toIndex === -1) return base;

      const next = [...base];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, [canManage, extraKeys]);

  return {
    columns: mergedColumns,
    statusOptions,
    addColumn,
    renameColumn,
    removeColumn,
    moveColumn,
    setColumns, // para uso avançado
  };
}
