"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatTicketStatusLabel, type TicketStatusOption } from "@/lib/ticketsStatus";

export type TicketKanbanColumn = {
  key: string;
  label: string;
  locked?: boolean;
};

const STORAGE_KEY = "ticket-kanban-columns:v1";

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

function loadStoredColumns() {
  if (typeof window === "undefined") return DEFAULT_COLUMNS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(raw) as TicketKanbanColumn[];
    if (!Array.isArray(parsed)) return DEFAULT_COLUMNS;

    const defaults = new Map(DEFAULT_COLUMNS.map((col) => [col.key, col]));
    const extras: TicketKanbanColumn[] = [];

    parsed.forEach((entry) => {
      const key = slugifyKey(entry?.key || "");
      const label = (entry?.label ?? "").toString().trim();
      if (!key) return;
      if (defaults.has(key)) {
        const base = defaults.get(key)!;
        defaults.set(key, { ...base, label: label || base.label });
        return;
      }
      extras.push({ key, label: label || formatTicketStatusLabel(key) });
    });

    return [...DEFAULT_COLUMNS.map((col) => defaults.get(col.key) ?? col), ...extras];
  } catch {
    return DEFAULT_COLUMNS;
  }
}

export function useTicketKanbanColumns(extraKeys: string[] = []) {
  const [columns, setColumns] = useState<TicketKanbanColumn[]>(DEFAULT_COLUMNS);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const stored = loadStoredColumns();
    // schedule setState to avoid synchronous state update inside effect
    Promise.resolve().then(() => setColumns(stored));
    hydratedRef.current = true;
  }, []);

  const mergedColumns = useMemo(
    () => mergeColumns(columns, extraKeys),
    [columns, extraKeys],
  );

  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
    } catch {}
  }, [columns]);

  const statusOptions = useMemo<TicketStatusOption[]>(
    () => mergedColumns.map((col) => ({ value: col.key, label: col.label })),
    [mergedColumns],
  );

  const addColumn = useCallback(
    (label: string) => {
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
      setColumns((prev) => [...prev, { key, label: trimmed }]);
      return key;
    },
    [mergedColumns],
  );

  const renameColumn = useCallback((key: string, label: string) => {
    const trimmed = (label ?? "").toString().trim();
    if (!trimmed || !key) return;
    setColumns((prev) => {
      const idx = prev.findIndex((col) => col.key === key);
      if (idx === -1) {
        return [...prev, { key, label: trimmed }];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], label: trimmed };
      return next;
    });
  }, []);

  const removeColumn = useCallback((key: string) => {
    setColumns((prev) => prev.filter((col) => col.key !== key && !col.locked));
  }, []);

  return {
    columns: mergedColumns,
    statusOptions,
    addColumn,
    renameColumn,
    removeColumn,
    setColumns, // para uso avançado
  };
}
