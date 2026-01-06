"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EmpresaIndexRedirect() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const slug = (params?.slug as string) || "empresa";
    router.replace(`/empresas/${slug}/dashboard`);
  }, [params, router]);

  return null;
}
