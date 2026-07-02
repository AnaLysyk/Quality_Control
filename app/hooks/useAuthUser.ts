"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
export { publishAuthUser } from "@/lib/authUserSync";
import { normalizeAuthenticatedUser } from "@/lib/auth/normalizeAuthenticatedUser";

export type { AuthUser } from "@/contracts/auth";

export function useAuthUser() {
  const auth = useAuth();
  const normalizedUser = useMemo(
    () => normalizeAuthenticatedUser(auth.user, auth.companies),
    [auth.user, auth.companies],
  );

  return {
    ...auth,
    normalizedUser,
  };
}

