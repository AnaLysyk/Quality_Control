"use client";

import { useCallback, useEffect, useState } from "react";

export interface AuthUser {
  id?: string;
  userId?: string;
  user?: string | null;
  username?: string | null;
  email?: string;
  phone?: string | null;
  fullName?: string | null;
  name?: string;
  avatarKey?: string | null;
  avatarUrl?: string | null;
  active?: boolean;
  status?: string | null;
  jobTitle?: string | null;
  job_title?: string | null;
  linkedinUrl?: string | null;
  linkedin_url?: string | null;
  companyId?: string;
  companySlug?: string;
  role?: string;
  globalRole?: string | null;
  companyRole?: string | null;
  permissionRole?: string | null;
  capabilities?: string[];
  isGlobalAdmin?: boolean;
}

const AUTH_USER_SYNC_EVENT = "tc:auth-user-sync";

type AuthUserSyncDetail = {
  user: AuthUser | null;
};

export function publishAuthUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AuthUserSyncDetail>(AUTH_USER_SYNC_EVENT, { detail: { user } }));
}

export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
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
        publishAuthUser(null);
        return;
      }

      const data: { user: AuthUser | null } = await res.json();
      setUser(data.user);
      publishAuthUser(data.user ?? null);
    } catch (error) {
      console.error("Failed to fetch user:", error);
      setUser(null);
      publishAuthUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    function handleUserSync(event: Event) {
      const detail = (event as CustomEvent<AuthUserSyncDetail>).detail;
      setUser(detail?.user ?? null);
      setLoading(false);
    }

    if (typeof window === "undefined") return undefined;
    window.addEventListener(AUTH_USER_SYNC_EVENT, handleUserSync as EventListener);
    return () => {
      window.removeEventListener(AUTH_USER_SYNC_EVENT, handleUserSync as EventListener);
    };
  }, []);

  return { user, loading, refreshUser };
}
