"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SuporteKanbanPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/chamados");
  }, [router]);

  return null;
}
