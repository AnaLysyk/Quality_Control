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

function normalizeClientThemeEntry(key: string, value: unknown): [string, ClientTheme] | null {
  if (!key || !value || typeof value !== "object") return null;

  const slug = key.trim().toLowerCase();
  if (!slug) return null;

  const record = value as Record<string, unknown>;
  return [
    slug,
    {
      accent: typeof record.accent === "string" ? record.accent : undefined,
      accentHover: typeof record.accentHover === "string" ? record.accentHover : undefined,
      accentActive: typeof record.accentActive === "string" ? record.accentActive : undefined,
      accentSoft: typeof record.accentSoft === "string" ? record.accentSoft : undefined,
      watermarkOpacity: typeof record.watermarkOpacity === "number" ? record.watermarkOpacity : undefined,
    },
  ];
}

function parseClientThemeMap(raw: string): Record<string, ClientTheme> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const rec = parsed as Record<string, unknown>;
    const out: Record<string, ClientTheme> = {};
    for (const [k, v] of Object.entries(rec)) {
      const entry = normalizeClientThemeEntry(k, v);
      if (entry) out[entry[0]] = entry[1];
    }
    return out;
  } catch {
    return {};
  }
}

const CLIENT_THEME_MAP = parseClientThemeMap(CLIENT_THEME_MAP_RAW);

function normalizeSlug(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

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
  const { user, companies, normalizedUser, loading: authLoading, refreshUser } = useAuth();
  const { primaryCompanySlug, defaultCompanySlug, companySlugs } =
    normalizedUser ?? { primaryCompanySlug: null, defaultCompanySlug: null, companySlugs: [] };
  const [activeClientSlug, setActiveClientSlugState] = useState<string | null>(null);
  const [loading, setLoading] = useState(authLoading);
  const [error, setError] = useState<string | null>(null);
  const globalContextRoles = [
    user?.role,
    user?.permissionRole,
    user?.companyRole,
    user?.globalRole,
  ]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase());

  const isGlobalAdmin =
    user?.isGlobalAdmin === true ||
    globalContextRoles.some((role) => role === "admin" || role === "leader_tc" || role === "technical_support");

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
  const clients = normalizedClients;

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setActiveClientSlugState(null);
      setLoading(false);
      setError(null);
      return;
    }

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
      ? normalizedClients.find((client) => normalizeSlug(client.slug) === normalizeSlug(stored) || normalizeSlug(client.id) === normalizeSlug(stored))?.slug ?? null
      : null;

    const cookieMatch = typeof document !== "undefined" ? document.cookie.match(/(?:^|; )active_company_slug=([^;]+)/) : null;
    const cookieActiveSlug = normalizeSlug(cookieMatch?.[1] ?? null) || null;

    // Order of preference for resolving active client slug:
    // 1) explicit cookie set by login (represents user choosing a company)
    // 2) for non-global-admin users: normalized primary/default company plus the stored company choice
    // For global admins we intentionally avoid inheriting a company from storage or implicit defaults
    // so the admin sees the global admin nav unless they explicitly requested a company via cookie.
    const preferredSlugs = [
      ...(cookieActiveSlug ? [cookieActiveSlug] : []),
      ...(!isGlobalAdmin
        ? [
            ...(primaryCompanySlug ? [primaryCompanySlug] : []),
            storedSlug,
            ...(defaultCompanySlug ? [defaultCompanySlug] : []),
            ...companySlugs,
          ]
        : []),
    ].filter((value, index, self): value is string => Boolean(value) && self.indexOf(value) === index);

    const resolvedSlug =
      preferredSlugs.find((candidate) => normalizedClients.some((client) => normalizeSlug(client.slug) === candidate || normalizeSlug(client.id) === candidate)) ??
      (isGlobalAdmin ? null : normalizedClients[0].slug);

    setActiveClientSlugState(resolvedSlug ?? null);
    if (resolvedSlug) {
      storage?.setItem(storageKey(user.id), resolvedSlug);
    } else {
      storage?.removeItem(storageKey(user.id));
    }

    setLoading(false);
    setError(null);
  }, [authLoading, normalizedClients, user, isGlobalAdmin, primaryCompanySlug, defaultCompanySlug, companySlugs]);

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

      const normalizedSlug = normalizeSlug(slug);
      const exists = clients.find((client) => normalizeSlug(client.slug) === normalizedSlug || normalizeSlug(client.id) === normalizedSlug);
      if (!exists) {
        return;
      }

      if (normalizedSlug && normalizeSlug(activeClientSlug) === normalizedSlug) {
        storage?.setItem(storageKey(user.id), exists.slug);
        return;
      }

      setActiveClientSlugState(exists.slug);
      storage?.setItem(storageKey(user.id), exists.slug);
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
    if (slug) root.dataset.client = slug;
    else delete root.dataset.client;

    const theme = slug ? CLIENT_THEME_MAP[slug] : undefined;
    root.style.setProperty("--tc-accent", theme?.accent ?? DEFAULT_THEME.accent);
    root.style.setProperty("--tc-accent-hover", theme?.accentHover ?? DEFAULT_THEME.accentHover);
    root.style.setProperty("--tc-accent-active", theme?.accentActive ?? DEFAULT_THEME.accentActive);
    root.style.setProperty("--tc-accent-soft", theme?.accentSoft ?? DEFAULT_THEME.accentSoft);
    if (typeof theme?.watermarkOpacity === "number") {
      root.style.setProperty("--tc-watermark-opacity", String(theme.watermarkOpacity));
    }
  }, [activeClientSlug]);

  const value = useMemo(
    () => ({
      clients,
      activeClientId,
      activeClientSlug,
      activeClient,
      loading,
      error,
      setActiveClientSlug,
      setActiveClientId: setActiveClientSlug,
      refreshClients,
    }),
    [
      clients,
      activeClientId,
      activeClientSlug,
      activeClient,
      loading,
      error,
      setActiveClientSlug,
      refreshClients,
    ],
  );

  return (
    <ClientContext.Provider value={value}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClientContext() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error("useClientContext deve ser usado dentro de ClientProvider");
  return ctx;
}
