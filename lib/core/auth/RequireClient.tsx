"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthSkeleton } from "@/components/AuthSkeleton";
import { useAuthUser } from "@/hooks/useAuthUser";
import { buildCompanyPath, buildCompanyPathForAccess } from "@/lib/companyRoutes";

type RequireClientProps = {
  slug?: string; // slug da rota /empresas/[slug]
  children: ReactNode;
  fallback?: ReactNode;
};

export function RequireClient({ slug, children, fallback }: RequireClientProps) {
  const { user, loading, error, refreshUser } = useAuthUser();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [mounted, setMounted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }

    const handle = setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(handle);
  }, [loading]);

  const role = typeof user?.role === "string" ? user.role.toLowerCase() : null;
  const permissionRole = typeof user?.permissionRole === "string" ? user.permissionRole.toLowerCase() : null;
  const isAdmin = role === "leader_tc" || role === "technical_support" || permissionRole === "leader_tc" || permissionRole === "technical_support" || user?.isGlobalAdmin === true;
  // testing_company_user can be linked to multiple companies; allow access to any of their clientSlugs
  const isTcUser = role === "testing_company_user" || permissionRole === "testing_company_user";
  const linkedSlugs: string[] = Array.isArray(user?.clientSlugs) ? (user.clientSlugs as string[]) : [];
  const isLinkedTcUser = isTcUser && !!slug && linkedSlugs.some((s) => s.toLowerCase() === slug.toLowerCase());
  const loginHref =
    pathname.startsWith("/") && pathname !== "/login" ? `/login?next=${encodeURIComponent(pathname)}` : "/login";

  const normalizedClientSlug = typeof user?.clientSlug === "string" ? user.clientSlug : typeof (user as { companySlug?: string | null } | null)?.companySlug === "string" ? (user as { companySlug?: string | null }).companySlug : null;

  const accessState = useMemo(() => {
    if (error) return "error" as const;
    if (loading && timedOut) return "timeout" as const;
    if (loading) return "loading" as const;
    if (!user) return "expired" as const;
    if (!slug) return "slug-missing" as const;
    if (isAdmin || isLinkedTcUser) return "allowed" as const;
    if (!normalizedClientSlug) return "denied" as const;
    if (slug && normalizedClientSlug.toLowerCase() !== slug.toLowerCase()) return "denied" as const;
    return "allowed" as const;
  }, [error, isAdmin, isLinkedTcUser, loading, normalizedClientSlug, slug, timedOut, user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(loginHref);
      return;
    }
    void isAdmin;
    void isLinkedTcUser;
  }, [isAdmin, loading, loginHref, router, slug, user]);

  if (!mounted || accessState === "loading") {
    return (fallback as ReactNode) ?? <AuthSkeleton message="Validando acesso da empresa" />;
  }

  if (accessState === "timeout") {
    return (
      <div className="tc-section space-y-3 rounded-2xl p-4">
        <div className="text-sm font-semibold">Validacao demorou demais</div>
        <button
          type="button"
          className="tc-button tc-button-primary"
          onClick={() => refreshUser(true)}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (accessState === "expired") {
    return (
      <div className="tc-section space-y-3 rounded-2xl p-4">
        <div className="text-sm font-semibold">Sessao expirada</div>
        <div className="text-xs text-muted">Redirecionando para login…</div>
      </div>
    );
  }

  if (accessState === "error") {
    return (
      <div className="tc-section space-y-3 rounded-2xl p-4">
        <div className="text-sm font-semibold">Nao foi possivel validar a sessao</div>
        <button
          type="button"
          className="tc-button tc-button-primary"
          onClick={() => refreshUser(true)}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (accessState === "slug-missing") {
    return (
      <div className="tc-section space-y-3 rounded-2xl p-4">
        <div className="text-sm font-semibold">Empresa nao encontrada</div>
        <Link className="tc-link" href="/empresas">
          Voltar para empresas
        </Link>
      </div>
    );
  }

  if (accessState === "denied") {
    const openHref = normalizedClientSlug
      ? buildCompanyPath(normalizedClientSlug, "home", { short: false })
      : "/empresas";

    return (
      <div className="tc-section space-y-3 rounded-2xl p-4">
        <div className="text-sm font-semibold">Acesso negado</div>
        <Link className="tc-link" href={openHref}>
          Abrir minha empresa
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
