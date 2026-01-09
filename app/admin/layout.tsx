"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const allowRunsForAll = pathname.startsWith("/admin/runs") || pathname.startsWith("/admin/releases");

  if (allowRunsForAll) {
    return <RequireAuth>{children}</RequireAuth>;
  }

  return <RequireGlobalAdmin>{children}</RequireGlobalAdmin>;
}
