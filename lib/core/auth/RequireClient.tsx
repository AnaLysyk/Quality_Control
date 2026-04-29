"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthSkeleton } from "@/components/AuthSkeleton";
import { useAuthUser } from "@/hooks/useAuthUser";
import { resolveCompanyAccess } from "@/lib/auth/normalizeAuthenticatedUser";

type RequireClientProps = {
  slug?: string; // slug da rota /empresas/[slug]
  children: ReactNode;
  fallback?: ReactNode;
};

const CLIENT_ACCESS_TIMEOUT_MS = 10_000;

export function RequireClient({ slug, children, fallback }: RequireClientProps) {
  const { user, companies, loading, error, refreshUser } = useAuthUser();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [validationTimedOut, setValidationTimedOut] = useState(false);
  const loginHref =
    pathname.startsWith("/") && pathname !== "/login" ? `/login?next=${encodeURIComponent(pathname)}` : "/login";
  const access = resolveCompanyAccess({
    user,
    companies,
    slug,
    loading: loading && !validationTimedOut,
    error: validationTimedOut ? "A validacao de acesso demorou mais que o esperado." : error,
  });

  useEffect(() => {
    if (!loading) {
      const resetId = window.setTimeout(() => setValidationTimedOut(false), 0);
      return () => window.clearTimeout(resetId);
    }
    const timeoutId = window.setTimeout(() => {
      setValidationTimedOut(true);
    }, CLIENT_ACCESS_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [loading]);

  useEffect(() => {
    if (access.status !== "unauthenticated") return;
    if (!user) {
      router.replace(loginHref);
    }
  }, [access.status, loginHref, router, user]);

  if (access.status === "loading") {
    return (fallback as ReactNode) ?? <AuthSkeleton message="Validando acesso da empresa" />;
  }

  if (access.status === "error") {
    const isTimeout = validationTimedOut && loading;
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h2 className="text-lg font-semibold">
          {isTimeout ? "Validacao demorou demais" : "Nao foi possivel validar a sessao"}
        </h2>
        <p className="mt-2 text-sm text-red-700">
          {isTimeout
            ? "A sessao ou o vinculo da empresa nao respondeu a tempo. Tente recarregar a validacao."
            : access.errorMessage ?? "Tente novamente em instantes."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setValidationTimedOut(false);
              void refreshUser(true);
            }}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Tentar novamente
          </button>
          <Link
            href={loginHref}
            className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-100"
          >
            Ir para login
          </Link>
        </div>
      </div>
    );
  }

  if (access.status === "unauthenticated") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-(--page-text,#0b1a3c)">
        <h2 className="text-lg font-semibold">Sessao expirada</h2>
        <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
          Estamos redirecionando para o login, mas voce tambem pode entrar manualmente.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={loginHref}
            className="rounded-xl bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Ir para login
          </Link>
        </div>
      </div>
    );
  }

  if (access.status === "not_found") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <h2 className="text-lg font-semibold">Empresa nao encontrada</h2>
        <p className="mt-2 text-sm text-amber-800">
          O slug informado na rota nao foi resolvido corretamente.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/empresas"
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            Voltar para empresas
          </Link>
        </div>
      </div>
    );
  }

  if (access.status === "denied") {
    const fallbackHref = access.fallbackSlug
      ? `/empresas/${encodeURIComponent(access.fallbackSlug)}/home`
      : "/empresas";
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-(--page-text,#0b1a3c)">
        <h2 className="text-lg font-semibold">Acesso negado</h2>
        <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
          Seu usuario nao tem vinculo com esta empresa.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={fallbackHref}
            className="rounded-xl bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Abrir minha empresa
          </Link>
          <Link
            href="/empresas"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            Voltar para empresas
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
