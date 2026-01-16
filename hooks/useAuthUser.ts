"use client";

import { useEffect, useState } from "react";

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  companyId: string;
  companySlug: string;
  role: string;
}

export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data: { user: AuthUser | null } = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
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
