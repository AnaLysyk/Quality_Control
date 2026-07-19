"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthSkeleton } from "@/components/AuthSkeleton";
import { useAuthUser } from "@/hooks/useAuthUser";
import { buildCompanyPath } from "@/backend/companyRoutes";

type RequireClientProps = {
  slug?: string; // slug da rota /empresas/[slug]
  children: ReactNode;
  fallback?: ReactNode;
};

type RequireClientAccessState =
  | "allowed"
  | "denied"
  | "error"
  | "expired"
  | "loading"
  | "slug-missing"
  | "timeout";

function readUserString(user: unknown, key: string) {
  const value = (user as Record<string, unknown> | null | undefined)?.[key];
  return typeof value === "string" ? value : null;
}

function normalizeRole(user: unknown, key: string) {
  return readUserString(user, key)?.toLowerCase() ?? null;
}

function resolveRoleAccess(user: unknown, slug?: string) {
  const role = normalizeRole(user, "role");
  const permissionRole = normalizeRole(user, "permissionRole");
  const isAdmin =
    role === "leader_tc" ||
    role === "technical_support" ||
    permissionRole === "leader_tc" ||
    permissionRole === "technical_support" ||
    (user as { isGlobalAdmin?: boolean } | null | undefined)?.isGlobalAdmin === true;
  const isTcUser = role === "testing_company_user" || permissionRole === "testing_company_user";
  const linkedSlugs = (user as { clientSlugs?: unknown } | null | undefined)?.clientSlugs;
  const isLinkedTcUser =
    isTcUser &&
    !!slug &&
    Array.isArray(linkedSlugs) &&
    linkedSlugs.some((value) => typeof value === "string" && value.toLowerCase() === slug.toLowerCase());
  return { isAdmin, isLinkedTcUser };
}

function resolveNormalizedClientSlug(user: unknown) {
  return readUserString(user, "clientSlug") ?? readUserString(user, "companySlug");
}

function resolveRequireClientAccessState(input: {
  error: unknown;
  isAdmin: boolean;
  isLinkedTcUser: boolean;
  loading: boolean;
  normalizedClientSlug: string | null;
  slug?: string;
  timedOut: boolean;
  user: unknown;
}): RequireClientAccessState {
  if (input.error) return "error";
  if (input.loading && input.timedOut) return "timeout";
  if (input.loading) return "loading";
  if (!input.user) return "expired";
  if (!input.slug) return "slug-missing";
  if (input.isAdmin || input.isLinkedTcUser) return "allowed";
  if (!input.normalizedClientSlug) return "denied";
  return input.normalizedClientSlug.toLowerCase() === input.slug.toLowerCase()
    ? "allowed"
    : "denied";
}

function subscribeMountedState() {
  return () => {};
}

function getClientMountedSnapshot() {
  return true;
}

function getServerMountedSnapshot() {
  return false;
}

export function RequireClient({ slug, children, fallback }: RequireClientProps) {
  const { user, loading, error, refreshUser } = useAuthUser();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const mounted = useSyncExternalStore(
    subscribeMountedState,
    getClientMountedSnapshot,
    getServerMountedSnapshot,
  );
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    if (!loading) {
      const timeoutId = window.setTimeout(() => setTimedOut(false), 0);
      return () => window.clearTimeout(timeoutId);
    }

    const handle = window.setTimeout(() => setTimedOut(true), 10_000);
    return () => window.clearTimeout(handle);
  }, [loading, mounted]);

  const { isAdmin, isLinkedTcUser } = resolveRoleAccess(user, slug);
  const loginHref =
    pathname.startsWith("/") && pathname !== "/login" ? `/login?next=${encodeURIComponent(pathname)}` : "/login";

  const normalizedClientSlug = resolveNormalizedClientSlug(user);

  const accessState = useMemo(() => {
    return resolveRequireClientAccessState({
      error,
      isAdmin,
      isLinkedTcUser,
      loading,
      normalizedClientSlug,
      slug,
      timedOut,
      user,
    });
  }, [error, isAdmin, isLinkedTcUser, loading, normalizedClientSlug, slug, timedOut, user]);

  useEffect(() => {
    if (!mounted) return;
    if (loading) return;
    if (!user) {
      router.replace(loginHref);
    }
  }, [loading, loginHref, mounted, router, user]);

  if (!mounted) {
    return (fallback as ReactNode) ?? <AuthSkeleton message="Validando acesso da empresa" />;
  }

  if (accessState === "loading") {
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

