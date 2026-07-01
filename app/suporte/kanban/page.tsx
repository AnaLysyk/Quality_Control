"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SuporteKanbanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  useEffect(() => {
    router.replace(`/admin/chamados${queryString ? `?${queryString}` : ""}`);
  }, [queryString, router]);

  return null;
}
