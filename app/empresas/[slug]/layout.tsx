"use client";

import { useParams } from "next/navigation";
import { RequireClient } from "@/components/RequireClient";

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  return (
    <RequireClient slug={slug}>
      <div className="flex flex-1 min-h-0 flex-col bg-(--page-bg,#f5f6fa) text-(--page-text,#0b1a3c)">{children}</div>
    </RequireClient>
  );
}
