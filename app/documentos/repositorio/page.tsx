"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DocumentosRepositorioPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to documentacao for now
    // Or could be a structured docs tree view
    router.replace("/documentacao");
  }, [router]);

  return null;
}

