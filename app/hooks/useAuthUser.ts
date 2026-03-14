"use client";

import { useAuth } from "@/context/AuthContext";
export { publishAuthUser } from "@/lib/authUserSync";

export type { AuthUser } from "@/contracts/auth";

export function useAuthUser() {
  return useAuth();
}
