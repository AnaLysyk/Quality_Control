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
import { getAccessToken } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { extractMessageFromJson, extractRequestIdFromJson, formatMessageWithRequestId, unwrapEnvelopeData } from "@/lib/apiEnvelope";

export type ClientAccess = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  role: "ADMIN" | "USER";
  linkActive: boolean;
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

type ClientApiItem = {
  client_id?: unknown;
  client_name?: unknown;
  client_slug?: unknown;
  client_active?: unknown;
  role?: unknown;
  link_active?: unknown;
};

type ClientApiResponse = {
  items?: ClientApiItem[];
  message?: unknown;
};

const normalizeClient = (item: ClientApiItem): ClientAccess | null => {
  if (!item) return null;
  const slug = typeof item.client_slug === "string" ? item.client_slug.trim() : "";
  if (!slug) return null;
  const idSource =
    typeof item.client_id === "string" && item.client_id.trim().length > 0 ? item.client_id.trim() : slug;
  const nameSource =
    typeof item.client_name === "string" && item.client_name.trim().length > 0 ? item.client_name.trim() : slug;
  const roleSource = typeof item.role === "string" ? item.role.toUpperCase() : "USER";
  return {
    id: idSource,
    name: nameSource,
    slug,
    active: item.client_active === true,
    role: roleSource === "ADMIN" ? "ADMIN" : "USER",
    linkActive: item.link_active !== false,
  };
};

async function fetchClients(): Promise<ClientAccess[]> {
  const token = await getAccessToken().catch(() => null);
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  // NOTE: `/api/clients` is admin-only (global admin management).
  // For regular authenticated users we must use `/api/me/clients`, which
  // returns only the companies linked to the current user.
  const res = await fetch("/api/me/clients", {
    method: "GET",
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (res.status === 401) throw new Error("Sessão expirada. Faça login novamente.");
  if (res.status === 403) throw new Error("Sem empresa vinculada. Peça ao admin para vincular seu usuário.");

  const raw = await res.json().catch(() => null);

  if (!res.ok) {
    const message = extractMessageFromJson(raw) || "Erro ao carregar empresas";
    const requestId = extractRequestIdFromJson(raw) || res.headers.get("x-request-id") || null;
    throw new Error(formatMessageWithRequestId(message, requestId));
  }

  const data = (unwrapEnvelopeData(raw) as ClientApiResponse | ClientApiItem[] | null) ?? raw;
  const items = Array.isArray((data as ClientApiResponse)?.items)
    ? ((data as ClientApiResponse).items as ClientApiItem[])
    : Array.isArray(data)
      ? (data as ClientApiItem[])
      : [];
  return items.map(normalizeClient).filter((item): item is ClientAccess => Boolean(item));
}

export function ClientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientAccess[]>([]);
  const [activeClientSlug, setActiveClientSlugState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeClient = useMemo(
    () => (activeClientSlug ? clients.find((client) => client.slug === activeClientSlug) ?? null : null),
    [clients, activeClientSlug]
  );

  const activeClientId = activeClient?.id ?? null;

  const refreshClients = useCallback(async () => {
    if (!user) {
      setClients([]);
      setActiveClientSlugState(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClients();
      setClients(data);
      if (data.length === 0) {
        setActiveClientSlugState(null);
        localStorage.removeItem(storageKey(user.id));
        return;
      }

      const stored = localStorage.getItem(storageKey(user.id));
      const storedSlug = stored
        ? data.find((client) => client.slug === stored || client.id === stored)?.slug ?? null
        : null;

      const preferredSlugs = [
        storedSlug,
        typeof user.defaultClientSlug === "string" ? user.defaultClientSlug : null,
        typeof user.clientSlug === "string" ? user.clientSlug : null,
        ...(Array.isArray(user.clientSlugs)
          ? user.clientSlugs.filter((item): item is string => typeof item === "string" && item.length > 0)
          : []),
      ].filter((value, index, self): value is string => Boolean(value) && self.indexOf(value) === index);

      const resolvedSlug = preferredSlugs.find((slug) => data.some((client) => client.slug === slug)) ?? data[0].slug;

      setActiveClientSlugState(resolvedSlug ?? null);
      if (resolvedSlug) {
        localStorage.setItem(storageKey(user.id), resolvedSlug);
      } else {
        localStorage.removeItem(storageKey(user.id));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar empresas";
      setError(msg);
      setClients([]);
      setActiveClientSlugState(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const setActiveClientSlug = useCallback(
    (slug: string | null) => {
      if (!user) {
        setActiveClientSlugState(null);
        return;
      }

      if (!slug) {
        setActiveClientSlugState(null);
        localStorage.removeItem(storageKey(user.id));
        return;
      }

      const exists = clients.find((client) => client.slug === slug);
      if (!exists) {
        return;
      }

      if (slug === activeClientSlug) {
        localStorage.setItem(storageKey(user.id), slug);
        return;
      }

      setActiveClientSlugState(slug);
      localStorage.setItem(storageKey(user.id), slug);
    },
    [clients, user, activeClientSlug]
  );

  useEffect(() => {
    // quando usuário muda, recarrega a lista
    if (!user) {
      setClients([]);
      setActiveClientSlugState(null);
      setLoading(false);
      setError(null);
      return;
    }
    refreshClients();
  }, [user, refreshClients]);

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
