"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { AuthMeResponseSchema, type AuthUser, type AuthCompany } from "@/contracts/auth";
import { getAccessToken, refreshClientSession } from "@/lib/api";
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
  refreshUser: (showSpinner?: boolean) => Promise<void>;
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

  const buildHeaders = async () => {
    const nextToken = await getAccessToken().catch(() => null);
    return nextToken ? { Authorization: `Bearer ${nextToken}` } : undefined;
  };

  const res = await fetch("/api/me", {
    method: "GET",
    headers: await buildHeaders(),
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
          headers: await buildHeaders(),
          credentials: "include",
          cache: "no-store",
        });
        const retry = await fetch("/api/me", {
          method: "GET",
          headers: await buildHeaders(),
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
        const refreshed = await refreshClientSession();
        if (refreshed) {
          const retry = await fetch("/api/me", {
            method: "GET",
            headers: await buildHeaders(),
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

const AUTH_CACHE_KEY = "qc:auth_me:v1";
const AUTH_CACHE_TTL_MS = 60_000; // 60 seconds

type AuthCache = {
  user: AuthUser | null;
  companies: AuthCompany[];
  cachedAt: number;
};

function readAuthCache(): AuthCache | null {
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthCache;
    if (Date.now() - parsed.cachedAt > AUTH_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeAuthCache(user: AuthUser | null, companies: AuthCompany[]) {
  try {
    const cache: AuthCache = { user, companies, cachedAt: Date.now() };
    sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

function clearAuthCache() {
  try {
    sessionStorage.removeItem(AUTH_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cached = typeof window !== "undefined" ? readAuthCache() : null;
  const [user, setUser] = useState<AuthUser | null>(cached?.user ?? null);
  const [companies, setCompanies] = useState<AuthCompany[]>(cached?.companies ?? []);
  const [loading, setLoading] = useState(cached === null); // skip spinner if cache hit
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const me = await fetchMe();
      setUser(me.user);
      setCompanies(me.companies);
      writeAuthCache(me.user, me.companies);
      publishAuthUser(me.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar usuario";
      setError(msg);
      setUser(null);
      setCompanies([]);
      clearAuthCache();
      publishAuthUser(null);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    bootstrapAttempts.clear();
    clearAuthCache();
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
      sessionStorage.removeItem("auth_ok");
    } catch {
      /* ignore */
    }

    setUser(null);
    setCompanies([]);
    publishAuthUser(null);
  }, []);

  useEffect(() => {
    // If we had a cache hit on mount, revalidate silently in background
    const hadCache = cached !== null;
    void refreshUser(!hadCache);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return subscribeAuthUserSync((nextUser) => {
      setUser(nextUser);
      if (!nextUser) setCompanies([]);
      setLoading(false);
    });
  }, []);

  const value = useMemo(
    () => ({ user, companies, loading, error, refreshUser, logout }),
    [user, companies, loading, error, refreshUser, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
