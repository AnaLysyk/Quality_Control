"use client";

import { useEffect, useState } from "react";

export type AuthUser = {
  id: string;
  name: string;
  email?: string;
  role?: string;
  clientId?: string | null;
  clientSlug?: string | null;
  isGlobalAdmin?: boolean;
};

export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) throw new Error("unauthorized");
      const json = await res.json();
      setUser(json.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshUser();
  }, []);

  return { user, loading, refreshUser };
}
