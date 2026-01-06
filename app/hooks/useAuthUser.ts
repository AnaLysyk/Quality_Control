"use client";

import { useAuth } from "@/context/AuthContext";
export type { AuthUser } from "@/contracts/auth";

export function useAuthUser() {
  return useAuth();
}
