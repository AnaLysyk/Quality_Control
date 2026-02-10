"use client";

import { useEffect, useState } from "react";

export interface AuthUser {
  id?: string;
  userId?: string;
  email?: string;
  name?: string;
  companyId?: string;
  companySlug?: string;
  role?: string;
  globalRole?: string | null;
  companyRole?: string | null;
  capabilities?: string[];
  isGlobalAdmin?: boolean;
}

export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const fetchMe = () =>
        fetch("/api/me", { credentials: "include", cache: "no-store" });

      let res = await fetchMe();
      if (res.status === 401) {
        const refreshed = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
        if (refreshed.ok) {
          res = await fetchMe();
        }
      }

      if (!res.ok) {
        setUser(null);
        return;
      }

      const data: { user: AuthUser | null } = await res.json();
      setUser(data.user);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return { user, loading, refreshUser };
}
