"use client";

import { useAuth } from "@/context/AuthContext";
import type { AppUser } from "@/types/User";

export type { AppUser };

export function useAuthUser(): {
  user: AppUser | null;
  loading: boolean;
  refreshUser: () => Promise<void> | void;
} {
  // assumindo que o AuthContext já faz o fetch de /api/me
  return useAuth() as unknown as {
    user: AppUser | null;
    loading: boolean;
    refreshUser: () => Promise<void> | void;
  };
}
