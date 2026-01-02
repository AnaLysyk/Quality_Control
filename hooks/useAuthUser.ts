"use client";

import { useAuth } from "@/context/AuthContext";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  isGlobalAdmin: boolean;
};

// Mantém a API existente, mas agora delega ao AuthContext
export function useAuthUser() {
  return useAuth();
}
