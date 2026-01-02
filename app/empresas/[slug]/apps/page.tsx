"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function LegacyAppsRedirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const slug = (params?.slug as string) || "empresa";
    router.replace(`/empresas/${slug}/aplicacoes`);
  }, [params, router]);

  return null;
}
