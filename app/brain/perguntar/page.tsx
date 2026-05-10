"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BrainPerguntarPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to chat for now, or keep as Brain ask interface
    // This should be the Brain assistant interface
    router.replace("/chat");
  }, [router]);

  return null;
}
