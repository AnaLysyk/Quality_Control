"use client";

import { useEffect, useState, useRef } from "react";

export interface AuthUser {
  id?: string;
  userId?: string;
  email?: string;
  name?: string;
  companyId?: string;
  companySlug?: string;
  role?: string;
  globalRole?: string | null;
  companyRole?: string | null;
  capabilities?: string[];
  isGlobalAdmin?: boolean;
}

/**
 * Hook para obter e atualizar o usuário autenticado.
 * Faz fetch em /api/me, tenta refresh automático se 401.
 * Retorna { user, loading, refreshUser }.
 */
export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Previne race condition em chamadas concorrentes
  const isMounted = useRef(true);

  const refreshUser = async () => {
    setLoading(true);
    try {
      const fetchMe = () =>
        fetch("/api/me", { credentials: "include", cache: "no-store" });

      let res = await fetchMe();
      if (res.status === 401) {
        const refreshed = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
        if (refreshed.ok) {
          res = await fetchMe();
        }
      }

      if (!res.ok) {
        if (isMounted.current) setUser(null);
        return;
      }

      const data: { user: AuthUser | null } = await res.json();
      if (isMounted.current) setUser(data.user);
    } catch (error: unknown) {
      // Tipagem robusta para erro
      if (isMounted.current) setUser(null);
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch user:", error);
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    refreshUser();
    return () => {
      isMounted.current = false;
    };
  }, []);

  return { user, loading, refreshUser };
}
