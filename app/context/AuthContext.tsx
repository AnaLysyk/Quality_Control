"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AuthMeResponseSchema, type AuthUser } from "@/contracts/auth";
import { getAccessToken } from "@/lib/api";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const bootstrapAttempts = new Map<string, number>();

async function fetchMe(): Promise<AuthUser | null> {
  const token = await getAccessToken().catch(() => null);
  const attemptKey = token ?? "__NO_TOKEN__";
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const res = await fetch("/api/me", {
    method: "GET",
    headers,
    credentials: "include",
    cache: "no-store",
  });

  // If the user is authenticated but is missing bootstrap records
  // (public.users/public.profiles), /api/me may return 401.
  // We only attempt bootstrap when /api/me explicitly signals it's needed.
  if (!res.ok) {
    const errorPayload = await res.json().catch(() => null);
    const errorParsed = AuthMeResponseSchema.safeParse(errorPayload);

    const errorCode = errorParsed.success ? errorParsed.data.error?.code : null;
    if (
      res.status === 401 &&
      headers &&
      errorCode === "NEEDS_BOOTSTRAP"
    ) {
      const attempts = bootstrapAttempts.get(attemptKey) ?? 0;
      if (attempts > 0) return null;
      bootstrapAttempts.set(attemptKey, attempts + 1);
      try {
        await fetch("/api/auth/bootstrap", {
          method: "POST",
          headers,
          credentials: "include",
          cache: "no-store",
        });
        const retry = await fetch("/api/me", {
          method: "GET",
          headers,
          credentials: "include",
          cache: "no-store",
        });
        if (!retry.ok) return null;
        const retryPayload = await retry.json().catch(() => null);
        const retryParsed = AuthMeResponseSchema.safeParse(retryPayload);
        if (!retryParsed.success) return null;
        bootstrapAttempts.delete(attemptKey);
        return retryParsed.data.user ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }

  const payload = await res.json().catch(() => null);
  const parsed = AuthMeResponseSchema.safeParse(payload);
  if (!parsed.success) return null;
  return parsed.data.user ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchMe();
      setUser(me);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar usuario";
      setError(msg);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    bootstrapAttempts.clear();
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch {
      /* ignore */
    }

    try {
      const mod = await import("@/lib/supabase/client");
      await mod.getSupabaseClient().auth.signOut();
    } catch {
      /* ignore */
    }

    try {
      localStorage.removeItem("auth_ok");
    } catch {
      /* ignore */
    }

    setUser(null);
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
