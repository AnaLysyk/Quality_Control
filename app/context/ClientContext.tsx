"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { getAccessToken } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type Client = {
  id: string;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
};

type ClientContextValue = {
  clients: Client[];
  activeClientId: string | null;
  activeClient: Client | null;
  loading: boolean;
  error: string | null;
  setActiveClientId: (id: string | null) => void;
  refreshClients: () => Promise<void>;
};

const ClientContext = createContext<ClientContextValue | undefined>(undefined);

const storageKey = (userId: string) => `activeClient:${userId}`;

async function fetchClients(): Promise<Client[]> {
  const token = await getAccessToken().catch(() => null);
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const res = await fetch("/api/clients", {
    method: "GET",
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    return [];
  }

  const payload = await res.json().catch(() => []);
  if (Array.isArray(payload?.items)) return payload.items as Client[];
  if (Array.isArray(payload)) return payload as Client[];
  return [];
}

export function ClientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClientId, setActiveClientIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeClient = useMemo(
    () => clients.find((c) => c.id === activeClientId) ?? null,
    [clients, activeClientId]
  );

  const refreshClients = async () => {
    if (!user) {
      setClients([]);
      setActiveClientIdState(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClients();
      setClients(data);
      if (data.length === 0) {
        setActiveClientIdState(null);
        return;
      }
      // tenta restaurar o client ativo do localStorage
      const stored = localStorage.getItem(storageKey(user.id));
      const exists = data.find((c) => c.id === stored);
      if (exists) {
        setActiveClientIdState(exists.id);
      } else {
        setActiveClientIdState(data[0].id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar clientes";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const setActiveClientId = (id: string | null) => {
    setActiveClientIdState(id);
    if (user && id) {
      localStorage.setItem(storageKey(user.id), id);
    }
  };

  useEffect(() => {
    // quando usuário muda, recarrega a lista
    if (!user) {
      setClients([]);
      setActiveClientIdState(null);
      return;
    }
    refreshClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <ClientContext.Provider
      value={{
        clients,
        activeClientId,
        activeClient,
        loading,
        error,
        setActiveClientId,
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
