"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SuportePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to support Kanban
    router.replace("/suporte/kanban");
  }, [router]);

  return null;
}
