"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function RedirectMockClient() {
  const router = useRouter();
  const params = useParams();
  useEffect(() => {
    const rest = (params?.rest as string[]) || [];
    const path = rest.length ? `/${rest.join("/")}` : "";
    router.replace(path ? `/empresas?path=${encodeURIComponent(path)}` : "/empresas");
  }, [params, router]);
  return null;
}
