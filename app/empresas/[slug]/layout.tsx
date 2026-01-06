"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { RequireClient } from "@/components/RequireClient";

export default function EmpresaLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const slug = (params?.slug as string) || undefined;

  return <RequireClient slug={slug}>{children}</RequireClient>;
}
