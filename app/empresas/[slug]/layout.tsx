"use client";

import { useParams } from "next/navigation";
import { RequireClient } from "@/components/RequireClient";

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  return <RequireClient slug={slug}>{children}</RequireClient>;
}
