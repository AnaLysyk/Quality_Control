"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";

type RequireClientProps = {
  slug?: string; // slug da rota /empresa/[slug]
  children: ReactNode;
  fallback?: ReactNode;
};

export function RequireClient({ slug, children, fallback }: RequireClientProps) {
  const { user, loading } = useAuthUser();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;

    const isAdmin = user.role === "admin" || user.isGlobalAdmin;
    if (isAdmin) return; // admin pode acessar qualquer empresa

    if (!user.clientSlug) {
      router.replace("/login");
      return;
    }

    if (slug && user.clientSlug !== slug) {
      router.replace(`/empresa/${user.clientSlug}/dashboard`);
    }
  }, [loading, user, slug, router]);

  if (loading) return (fallback as ReactNode) ?? null;
  if (!user) return (fallback as ReactNode) ?? null;

  return <>{children}</>;
}
