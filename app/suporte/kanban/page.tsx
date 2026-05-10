"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SuporteKanbanPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to admin chamados (which has Kanban)
    router.replace("/admin/chamados");
  }, [router]);

  return null;
}
