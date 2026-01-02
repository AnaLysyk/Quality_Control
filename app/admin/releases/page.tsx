"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminReleasesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/runs");
  }, [router]);
  return null;
}
