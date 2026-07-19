"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
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
const ALL_LINKED_COMPANIES_STORAGE_VALUE = "__all_linked_companies__";

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
    const out: Record<string, ClientTheme> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const entry = normalizeClientThemeEntry(key, value);
      if (entry) out[entry[0]] = entry[1];
    }
    return out;
  } catch {
    return {};
  }
}

const CLIENT_THEME_MAP = parseClientThemeMap(CLIENT_THEME_MAP_RAW);
const DEFAULT_THEME = {
  accent: "#ef0001",
  accentHover: "#c80001",
  accentActive: "#a80001",
  accentSoft: "rgba(239, 0, 1, 0.12)",
};

function normalizeSlug(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

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

  const roles = [user?.role, user?.permissionRole, user?.companyRole, user?.globalRole]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase());

  // Líder TC não é contexto global. Somente administrador global e administrador
  // podem operar sem uma empresa vinculada ativa.
  const hasGlobalCompanyContext =
    user?.isGlobalAdmin === true ||
    roles.some((role) => role === "admin" || role === "global_admin" || role === "technical_support");

  const canUseAllLinkedCompanies =
    !hasGlobalCompanyContext &&
    normalizedUser?.roles.includes("testing_company_user") === true &&
    companies.length > 1;

  const clients = useMemo<ClientAccess[]>(
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
        createdAt:
          typeof (company as { createdAt?: string | null }).createdAt === "string"
            ? (company as { createdAt?: string | null }).createdAt
            : null,
      })),
    [companies],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (authLoading) {
        setLoading(true);
        return;
      }

      if (!user || clients.length === 0) {
        setActiveClientSlugState(null);
        if (user) getSessionStorage()?.removeItem(storageKey(user.id));
        setLoading(false);
        setError(null);
        return;
      }

      const storage = getSessionStorage();
      const stored = storage?.getItem(storageKey(user.id)) ?? null;
      const wantsAll = canUseAllLinkedCompanies && stored === ALL_LINKED_COMPANIES_STORAGE_VALUE;
      const storedSlug = stored && !wantsAll
        ? clients.find(
            (client) =>
              normalizeSlug(client.slug) === normalizeSlug(stored) ||
              normalizeSlug(client.id) === normalizeSlug(stored),
          )?.slug ?? null
        : null;

      const cookieMatch = document.cookie.match(/(?:^|; )active_company_slug=([^;]+)/);
      const cookieSlug = normalizeSlug(cookieMatch?.[1] ?? null) || null;

      const preferred = wantsAll
        ? []
        : [
            ...(cookieSlug ? [cookieSlug] : []),
            ...(primaryCompanySlug ? [primaryCompanySlug] : []),
            storedSlug,
            ...(defaultCompanySlug ? [defaultCompanySlug] : []),
            ...companySlugs,
          ].filter((value, index, self): value is string => Boolean(value) && self.indexOf(value) === index);

      const resolved = wantsAll
        ? null
        : preferred.find((candidate) =>
            clients.some(
              (client) =>
                normalizeSlug(client.slug) === normalizeSlug(candidate) ||
                normalizeSlug(client.id) === normalizeSlug(candidate),
            ),
          ) ?? (hasGlobalCompanyContext ? null : clients[0]?.slug ?? null);

      setActiveClientSlugState(resolved ?? null);
      if (resolved) storage?.setItem(storageKey(user.id), resolved);
      else if (wantsAll) storage?.setItem(storageKey(user.id), ALL_LINKED_COMPANIES_STORAGE_VALUE);
      else storage?.removeItem(storageKey(user.id));

      setLoading(false);
      setError(null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    authLoading,
    clients,
    user,
    hasGlobalCompanyContext,
    primaryCompanySlug,
    defaultCompanySlug,
    companySlugs,
    canUseAllLinkedCompanies,
  ]);

  const refreshClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshUser(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar empresas");
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
        if (canUseAllLinkedCompanies) storage?.setItem(storageKey(user.id), ALL_LINKED_COMPANIES_STORAGE_VALUE);
        else storage?.removeItem(storageKey(user.id));
        return;
      }

      const normalized = normalizeSlug(slug);
      const exists = clients.find(
        (client) => normalizeSlug(client.slug) === normalized || normalizeSlug(client.id) === normalized,
      );
      if (!exists) return;

      setActiveClientSlugState(exists.slug);
      storage?.setItem(storageKey(user.id), exists.slug);
    },
    [clients, user, canUseAllLinkedCompanies],
  );

  const activeClient = useMemo(
    () => (activeClientSlug ? clients.find((client) => client.slug === activeClientSlug) ?? null : null),
    [clients, activeClientSlug],
  );
  const activeClientId = activeClient?.id ?? null;

  useEffect(() => {
    const root = document.documentElement;
    const slug = normalizeSlug(activeClientSlug);
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

  const value = useMemo<ClientContextValue>(
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
    [clients, activeClientId, activeClientSlug, activeClient, loading, error, setActiveClientSlug, refreshClients],
  );

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
}

export function useClientContext() {
  const context = useContext(ClientContext);
  if (!context) throw new Error("useClientContext deve ser usado dentro de ClientProvider");
  return context;
}
