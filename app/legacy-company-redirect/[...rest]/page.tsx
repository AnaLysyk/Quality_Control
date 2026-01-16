"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function LegacyEmpresaRedirect() {
  const params = useParams();
  const router = useRouter();
  useEffect(() => {
    const parts = (params?.rest as string[]) || [];
    if (parts.length >= 2 && parts[1] === "dashboard") {
      const slug = parts[0];
      router.replace(`/empresas/${slug}/dashboard`);
    } else {
      router.replace("/empresas");
    }
  }, [params, router]);
  return null;
}
