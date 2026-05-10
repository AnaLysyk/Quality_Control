"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OperacoesBuscarPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to operacao search page
    router.replace("/operacao");
  }, [router]);

  return null;
}
