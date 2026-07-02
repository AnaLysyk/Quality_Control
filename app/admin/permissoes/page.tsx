"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PermissoesPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to permissions management
    router.replace("/admin/users/permissions");
  }, [router]);

  return null;
}

