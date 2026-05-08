"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreateFavoriteInput, FavoriteItem } from "@/lib/navigation/favoritesTypes";

const LOCAL_KEY = "qc:favorites";

function loadLocalFavorites(): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as FavoriteItem[]) : [];
  } catch {
    return [];
  }
}

function saveLocalFavorites(items: FavoriteItem[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function makeLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from API, fall back to localStorage
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function loadFavorites() {
      try {
        const res = await fetch("/api/favorites", { credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as { favorites: FavoriteItem[] };
          if (!cancelled) {
            setFavorites(data.favorites ?? []);
            // Sync to local as backup
            saveLocalFavorites(data.favorites ?? []);
          }
        } else {
          // Fallback to localStorage
          if (!cancelled) setFavorites(loadLocalFavorites());
        }
      } catch {
        if (!cancelled) setFavorites(loadLocalFavorites());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadFavorites();
    return () => {
      cancelled = true;
    };
  }, []);

  const addFavorite = useCallback(async (input: CreateFavoriteInput): Promise<void> => {
    // Optimistic update
    const optimistic: FavoriteItem = {
      ...input,
      id: makeLocalId(),
      userId: "local",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setFavorites((prev) => {
      // Avoid duplicates by href
      if (prev.some((f) => f.href === input.href)) return prev;
      const next = [...prev, optimistic];
      saveLocalFavorites(next);
      return next;
    });

    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const data = (await res.json()) as { favorite: FavoriteItem };
        setFavorites((prev) => {
          const next = prev.map((f) => (f.id === optimistic.id ? data.favorite : f));
          saveLocalFavorites(next);
          return next;
        });
      }
    } catch {
      // Keep optimistic update
    }
  }, []);

  const removeFavorite = useCallback(async (id: string): Promise<void> => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.id !== id);
      saveLocalFavorites(next);
      return next;
    });

    // Only call API for non-local IDs
    if (id.startsWith("local_")) return;

    try {
      await fetch(`/api/favorites/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch {
      // ignore
    }
  }, []);

  const isFavorite = useCallback(
    (href: string): boolean => favorites.some((f) => f.href === href),
    [favorites],
  );

  const getFavoriteByHref = useCallback(
    (href: string): FavoriteItem | undefined => favorites.find((f) => f.href === href),
    [favorites],
  );

  return { favorites, loading, addFavorite, removeFavorite, isFavorite, getFavoriteByHref };
}
