"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";

type ClientTheme = {
  accent?: string;
  accentHover?: string;
  accentActive?: string;
  accentSoft?: string;
  watermarkOpacity?: number;
};

const CLIENT_THEME_MAP_RAW = process.env.NEXT_PUBLIC_CLIENT_THEME_MAP || "";

function parseClientThemeMap(raw: string): Record<string, ClientTheme> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const rec = parsed as Record<string, unknown>;
    const out: Record<string, ClientTheme> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (!k) continue;
      if (!v || typeof v !== "object") continue;
      const slug = k.trim().toLowerCase();
      if (!slug) continue;
      const vv = v as Record<string, unknown>;
      out[slug] = {
        accent: typeof vv.accent === "string" ? vv.accent : undefined,
        accentHover: typeof vv.accentHover === "string" ? vv.accentHover : undefined,
        accentActive: typeof vv.accentActive === "string" ? vv.accentActive : undefined,
        accentSoft: typeof vv.accentSoft === "string" ? vv.accentSoft : undefined,
        watermarkOpacity: typeof vv.watermarkOpacity === "number" ? vv.watermarkOpacity : undefined,
      };
    }
    return out;
  } catch {
    return {};
  }
}

const CLIENT_THEME_MAP = parseClientThemeMap(CLIENT_THEME_MAP_RAW);

const DEFAULT_THEME: Required<Pick<ClientTheme, "accent" | "accentHover" | "accentActive" | "accentSoft">> = {
  accent: "#ef0001",
  accentHover: "#c80001",
  accentActive: "#a80001",
  accentSoft: "rgba(239, 0, 1, 0.12)",
};

export type ClientAccess = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  role: "ADMIN" | "USER";
  linkActive: boolean;
  createdAt?: string | null;
  logoUrl?: string | null;
};

type ClientContextValue = {
  clients: ClientAccess[];
  activeClientId: string | null;
  activeClientSlug: string | null;
  activeClient: ClientAccess | null;
  loading: boolean;
  error: string | null;
  setActiveClientSlug: (slug: string | null) => void;
  setActiveClientId: (slug: string | null) => void;
  refreshClients: () => Promise<void>;
};

const ClientContext = createContext<ClientContextValue | undefined>(undefined);

const storageKey = (userId: string) => `activeClient:${userId}`;
const getSessionStorage = () => (typeof window === "undefined" ? null : window.sessionStorage);

export function ClientProvider({ children }: { children: ReactNode }) {
  const { user, companies, loading: authLoading, refreshUser } = useAuth();
  const [clients, setClients] = useState<ClientAccess[]>([]);
  const [activeClientSlug, setActiveClientSlugState] = useState<string | null>(null);
  const [loading, setLoading] = useState(authLoading);
  const [error, setError] = useState<string | null>(null);
  const isGlobalAdmin =
    user?.isGlobalAdmin === true || (typeof user?.role === "string" && user.role.toLowerCase() === "admin");

  const normalizedClients = useMemo(
    () =>
      companies.map((company) => ({
        id: company.id,
        name: company.name,
        slug: company.slug,
        active: company.active ?? true,
        logoUrl:
          typeof (company as { logoUrl?: string | null }).logoUrl === "string"
            ? (company as { logoUrl?: string | null }).logoUrl
            : null,
        role: ((company.role ?? "").toUpperCase() === "ADMIN" ? "ADMIN" : "USER") as ClientAccess["role"],
        linkActive: true,
        createdAt: typeof (company as { createdAt?: string | null }).createdAt === "string"
          ? (company as { createdAt?: string | null }).createdAt
          : null,
      })),
    [companies]
  );

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setClients([]);
      setActiveClientSlugState(null);
      setLoading(false);
      setError(null);
      return;
    }

    setClients(normalizedClients);
    if (normalizedClients.length === 0) {
      setActiveClientSlugState(null);
      getSessionStorage()?.removeItem(storageKey(user.id));
      setLoading(false);
      setError(null);
      return;
    }

    const storage = getSessionStorage();
    const stored = storage?.getItem(storageKey(user.id)) ?? null;
    const storedSlug = stored
      ? normalizedClients.find((client) => client.slug === stored || client.id === stored)?.slug ?? null
      : null;

    const cookieMatch = typeof document !== "undefined" ? document.cookie.match(/(?:^|; )active_company_slug=([^;]+)/) : null;
    const cookieActiveSlug = cookieMatch?.[1] ?? null;

    // Order of preference for resolving active client slug:
    // 1) explicit cookie set by login (represents user choosing a company)
    // 2) for non-global-admin users: user.clientSlug, storedSlug, defaultClientSlug, clientSlugs
    // For global admins we intentionally avoid inheriting a company from user.clientSlug or storage
    // so the admin sees the global admin nav unless they explicitly requested a company via cookie.
    const preferredSlugs = [
      ...(cookieActiveSlug ? [cookieActiveSlug] : []),
      ...(!isGlobalAdmin
        ? [
            ...(typeof user.clientSlug === "string" && user.clientSlug ? [user.clientSlug] : []),
            storedSlug,
            ...(typeof user.defaultClientSlug === "string" ? [user.defaultClientSlug] : []),
            ...(Array.isArray(user.clientSlugs)
              ? user.clientSlugs.filter((item): item is string => typeof item === "string" && item.length > 0)
              : []),
          ]
        : []),
    ].filter((value, index, self): value is string => Boolean(value) && self.indexOf(value) === index);

    const resolvedSlug =
      preferredSlugs.find((candidate) => normalizedClients.some((client) => client.slug === candidate)) ??
      (isGlobalAdmin ? null : normalizedClients[0].slug);

    setActiveClientSlugState(resolvedSlug ?? null);
    if (resolvedSlug) {
      storage?.setItem(storageKey(user.id), resolvedSlug);
    } else {
      storage?.removeItem(storageKey(user.id));
    }

    setLoading(false);
    setError(null);
  }, [authLoading, normalizedClients, user, isGlobalAdmin]);

  const refreshClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshUser();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar empresas";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  const setActiveClientSlug = useCallback(
    (slug: string | null) => {
      if (!user) {
        setActiveClientSlugState(null);
        return;
      }

      const storage = getSessionStorage();

      if (!slug) {
        setActiveClientSlugState(null);
        storage?.removeItem(storageKey(user.id));
        return;
      }

      const exists = clients.find((client) => client.slug === slug);
      if (!exists) {
        return;
      }

      if (slug === activeClientSlug) {
        storage?.setItem(storageKey(user.id), slug);
        return;
      }

      setActiveClientSlugState(slug);
      storage?.setItem(storageKey(user.id), slug);
    },
    [clients, user, activeClientSlug]
  );

  const activeClient = useMemo(
    () => (activeClientSlug ? clients.find((client) => client.slug === activeClientSlug) ?? null : null),
    [clients, activeClientSlug]
  );

  const activeClientId = activeClient?.id ?? null;

  useEffect(() => {
    const root = document.documentElement;
    const slug = (activeClientSlug ?? "").trim().toLowerCase();
    if (slug) root.setAttribute("data-client", slug);
    else root.removeAttribute("data-client");

    const theme = slug ? CLIENT_THEME_MAP[slug] : undefined;
    root.style.setProperty("--tc-accent", theme?.accent ?? DEFAULT_THEME.accent);
    root.style.setProperty("--tc-accent-hover", theme?.accentHover ?? DEFAULT_THEME.accentHover);
    root.style.setProperty("--tc-accent-active", theme?.accentActive ?? DEFAULT_THEME.accentActive);
    root.style.setProperty("--tc-accent-soft", theme?.accentSoft ?? DEFAULT_THEME.accentSoft);
    if (typeof theme?.watermarkOpacity === "number") {
      root.style.setProperty("--tc-watermark-opacity", String(theme.watermarkOpacity));
    }
  }, [activeClientSlug]);

  return (
    <ClientContext.Provider
      value={{
        clients,
        activeClientId,
        activeClientSlug,
        activeClient,
        loading,
        error,
        setActiveClientSlug,
        setActiveClientId: setActiveClientSlug,
        refreshClients,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClientContext() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error("useClientContext deve ser usado dentro de ClientProvider");
  return ctx;
}
