"use client";

import { ReactNode } from "react";
import { RequireGlobalAdmin } from "@/components/RequireGlobalAdmin";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RequireGlobalAdmin>{children}</RequireGlobalAdmin>;
}
