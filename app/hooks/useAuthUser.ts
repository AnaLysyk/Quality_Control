"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
export { publishAuthUser } from "@/lib/authUserSync";
import { normalizeAuthenticatedUser } from "@/lib/auth/normalizeAuthenticatedUser";

export type { AuthUser } from "@/contracts/auth";

function useSafeAuth() {
  try {
    return useAuth();
  } catch {
    return {
      user: null,
      companies: [],
      loading: false,
      error: null,
      refreshUser: async () => ({ user: null, companies: [] }),
      logout: async () => undefined,
      normalizedUser: null,
    };
  }
}

export function useAuthUser() {
  const auth = useSafeAuth();
  const normalizedUser = useMemo(
    () => normalizeAuthenticatedUser(auth.user, auth.companies),
    [auth.user, auth.companies],
  );

  return {
    ...auth,
    normalizedUser,
  };
}
