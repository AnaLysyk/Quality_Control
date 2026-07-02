"use client";

import { useCallback, useEffect, useState } from "react";

const COLLAPSED_KEY = "qc:sidebar:collapsed";
const OPEN_SECTIONS_KEY = "qc:sidebar:sections";

function readLocalBool(key: string, defaultValue: boolean): boolean {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return raw === "true";
  } catch {
    return defaultValue;
  }
}

function readLocalSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleSection = useCallback((moduleId: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      try {
        localStorage.setItem(OPEN_SECTIONS_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const openSection = useCallback((moduleId: string) => {
    setOpenSections((prev) => {
      if (prev.has(moduleId)) return prev;
      const next = new Set(prev);
      next.add(moduleId);
      try {
        localStorage.setItem(OPEN_SECTIONS_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setCollapsed(readLocalBool(COLLAPSED_KEY, false));
    setOpenSections(readLocalSet(OPEN_SECTIONS_KEY));
  }, []);

  return { collapsed, toggleCollapsed, openSections, toggleSection, openSection };
}

