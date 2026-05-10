"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OperacoesDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to admin dashboard
    router.replace("/admin/dashboard");
  }, [router]);

  return null;
}
