"use client";

import { ReactNode } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { RequireAuth } from "./RequireAuth";

type RequireGlobalAdminProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function RequireGlobalAdmin({ children, fallback }: RequireGlobalAdminProps) {
  const { user } = useAuthUser();
  const isAdmin =
    user?.role === "admin" ||
    user?.isGlobalAdmin === true ||
    (user as any)?.is_global_admin === true;

  if (!isAdmin) {
    return (
      (fallback as ReactNode) ?? (
        <div className="p-4 text-sm text-red-600">Acesso restrito a admin global.</div>
      )
    );
  }

  return <RequireAuth fallback={fallback}>{children}</RequireAuth>;
}
