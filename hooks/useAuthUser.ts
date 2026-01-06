"use client";

import { useAuth } from "@/context/AuthContext";
export type { AuthUser } from "@/contracts/auth";

// Keeps the existing API but delegates to AuthContext.
export function useAuthUser() {
  return useAuth();
}
