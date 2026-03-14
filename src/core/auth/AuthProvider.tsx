"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AuthMeResponseSchema, type AuthUser, type AuthCompany } from "@/contracts/auth";
import { getAccessToken } from "@/lib/api";
import { unwrapEnvelopeData } from "@/lib/apiEnvelope";
import { publishAuthUser, subscribeAuthUserSync } from "@/lib/authUserSync";

type MeResult = {
  user: AuthUser | null;
  companies: AuthCompany[];
};

type AuthContextValue = {
  user: AuthUser | null;
  companies: AuthCompany[];
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const bootstrapAttempts = new Map<string, number>();

function parseMeResponse(payload: unknown): MeResult | null {
  const data = unwrapEnvelopeData(payload);
  const parsed = AuthMeResponseSchema.safeParse(data);
  if (!parsed.success) return null;
  return {
    user: parsed.data.user ?? null,
    companies: parsed.data.companies ?? [],
  };
}

async function fetchMe(): Promise<MeResult> {
  const token = await getAccessToken().catch(() => null);
  const attemptKey = token ?? "__COOKIE_OR_NO_TOKEN__";
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const res = await fetch("/api/me", {
    method: "GET",
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    const errorPayload = await res.json().catch(() => null);
    const errorParsed = AuthMeResponseSchema.safeParse(errorPayload);

    const errorCode = (() => {
      if (errorParsed.success) return errorParsed.data.error?.code ?? null;
      if (errorPayload && typeof errorPayload === "object") {
        const rec = errorPayload as Record<string, unknown>;
        const error = rec.error;
        if (error && typeof error === "object") {
          const code = (error as Record<string, unknown>).code;
          if (typeof code === "string" && code.trim()) return code.trim();
        }
      }
      return null;
    })();
    if (res.status === 401 && errorCode === "NEEDS_BOOTSTRAP") {
      const attempts = bootstrapAttempts.get(attemptKey) ?? 0;
      if (attempts > 0) return { user: null, companies: [] };
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
        if (!retry.ok) return { user: null, companies: [] };
        const retryPayload = await retry.json().catch(() => null);
        const parsedRetry = parseMeResponse(retryPayload);
        if (!parsedRetry) return { user: null, companies: [] };
        bootstrapAttempts.delete(attemptKey);
        return parsedRetry;
      } catch {
        return { user: null, companies: [] };
      }
    }

    if (res.status === 401) {
      try {
        const refreshed = await fetch("/api/auth/refresh", {
          method: "POST",
          headers,
          credentials: "include",
          cache: "no-store",
        });
        if (refreshed.ok) {
          const retry = await fetch("/api/me", {
            method: "GET",
            headers,
            credentials: "include",
            cache: "no-store",
          });
          if (retry.ok) {
            const retryPayload = await retry.json().catch(() => null);
            const parsedRetry = parseMeResponse(retryPayload);
            if (parsedRetry) return parsedRetry;
          }
        }
      } catch {
        /* ignore */
      }
    }
    return { user: null, companies: [] };
  }

  const payload = await res.json().catch(() => null);
  const parsed = parseMeResponse(payload);
  return parsed ?? { user: null, companies: [] };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [companies, setCompanies] = useState<AuthCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchMe();
      setUser(me.user);
      setCompanies(me.companies);
      publishAuthUser(me.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar usuario";
      setError(msg);
      setUser(null);
      setCompanies([]);
      publishAuthUser(null);
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
      localStorage.removeItem("auth_ok");
    } catch {
      /* ignore */
    }

    setUser(null);
    setCompanies([]);
    publishAuthUser(null);
  };

  useEffect(() => {
    void refreshUser();
  }, []);

  useEffect(() => {
    return subscribeAuthUserSync((nextUser) => {
      setUser(nextUser);
      if (!nextUser) setCompanies([]);
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, companies, loading, error, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
