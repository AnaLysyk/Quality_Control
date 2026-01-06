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

async function fetchMe(): Promise<AuthUser | null> {
  const token = await getAccessToken().catch(() => null);
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const res = await fetch("/api/me", {
    method: "GET",
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) return null;

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
    try {
      // Limpa storage/cookies locais. Se existir uma rota de logout no backend, chame aqui.
      localStorage.removeItem("auth_ok");
      document.cookie = "auth=; Max-Age=0; path=/;";
      document.cookie = "auth_token=; Max-Age=0; path=/;";
    } catch {
      /* ignore */
    } finally {
      setUser(null);
    }
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
