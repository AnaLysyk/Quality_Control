"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function RedirectMockClient() {
  const router = useRouter();
  const params = useParams();
  useEffect(() => {
    const rest = (params?.rest as string[]) || [];
    const path = rest.length ? `/${rest.join("/")}` : "/dashboard";
    router.replace(`/empresas/griaule${path}`);
  }, [params, router]);
  return null;
}
