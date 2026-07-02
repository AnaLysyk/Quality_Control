"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OperacoesMetricasPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to admin test metrics
    router.replace("/admin/test-metric");
  }, [router]);

  return null;
}

