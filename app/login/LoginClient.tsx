"use client";

import Link from "next/link";
import Image from "next/image";
import styles from "./LoginClient.module.css";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthUser } from "@/hooks/useAuthUser";
import { FiEye, FiEyeOff } from "react-icons/fi";

type AuthUserShape = {
  role?: string | null;
  globalRole?: string | null;
  isGlobalAdmin?: boolean;
  clientSlug?: string | null;
  companySlug?: string | null;
};

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuthUser();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousRootAttr = html.getAttribute("data-login-route");
    const previousBodyAttr = body.getAttribute("data-login-route");
    const inlineTargets = [html, body];
    const inlineKeys = ["opacity", "filter", "backdrop-filter", "pointer-events"] as const;
    const previousInline = inlineTargets.map((target) => ({
      target,
      styles: inlineKeys.map((key) => ({
        key,
        value: target.style.getPropertyValue(key),
        priority: target.style.getPropertyPriority(key),
      })),
    }));

    html.setAttribute("data-login-route", "true");
    body.setAttribute("data-login-route", "true");
    for (const target of inlineTargets) {
      target.style.setProperty("opacity", "1", "important");
      target.style.setProperty("filter", "none", "important");
      target.style.setProperty("backdrop-filter", "none", "important");
      target.style.setProperty("pointer-events", "auto", "important");
    }

    // Defensive cleanup: if a fullscreen overlay leaks from another route/component,
    // keep login interactive by disabling that overlay while this page is mounted.
    const root = rootRef.current;
    if (!root) return;

    const changed: Array<{
      element: HTMLElement;
      pointerEvents: string;
      opacity: string;
    }> = [];

    const isLikelyOverlay = (element: HTMLElement) => {
      if (root.contains(element)) return false;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (style.position !== "fixed" && style.position !== "absolute") return false;

      const rect = element.getBoundingClientRect();
      const coversViewport = rect.width >= window.innerWidth * 0.95 && rect.height >= window.innerHeight * 0.95;
      if (!coversViewport) return false;

      const zIndex = Number.parseInt(style.zIndex || "0", 10);
      if (Number.isNaN(zIndex) || zIndex < 40) return false;

      const hasBackdrop = style.backdropFilter !== "none";
      const hasVisibleTint =
        style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
        style.backgroundColor !== "transparent";
      return hasBackdrop || hasVisibleTint;
    };

    const nodes = Array.from(document.documentElement.querySelectorAll<HTMLElement>("*"));
    for (const element of nodes) {
      if (!isLikelyOverlay(element)) continue;
      changed.push({
        element,
        pointerEvents: element.style.pointerEvents,
        opacity: element.style.opacity,
      });
      element.style.pointerEvents = "none";
      element.style.opacity = "0";
    }

    return () => {
      if (previousRootAttr === null) html.removeAttribute("data-login-route");
      else html.setAttribute("data-login-route", previousRootAttr);
      if (previousBodyAttr === null) body.removeAttribute("data-login-route");
      else body.setAttribute("data-login-route", previousBodyAttr);

      for (const entry of previousInline) {
        for (const style of entry.styles) {
          if (style.value) {
            entry.target.style.setProperty(style.key, style.value, style.priority);
          } else {
            entry.target.style.removeProperty(style.key);
          }
        }
      }

      for (const entry of changed) {
        entry.element.style.pointerEvents = entry.pointerEvents;
        entry.element.style.opacity = entry.opacity;
      }
    };
  }, []);

  function resolvePostLoginRedirect(nextParam: string | null, authUser: AuthUserShape | null) {
    const safeNext = typeof nextParam === "string" && nextParam.startsWith("/") ? nextParam : "";
    if (safeNext) return safeNext;
    const normalizedRole = typeof authUser?.role === "string" ? authUser.role.toLowerCase() : "";
    const isAdmin =
      authUser?.isGlobalAdmin === true ||
      authUser?.globalRole === "global_admin" ||
      normalizedRole === "admin";
    const clientSlug =
      typeof authUser?.clientSlug === "string"
        ? authUser.clientSlug
        : typeof authUser?.companySlug === "string"
          ? authUser.companySlug
          : null;
    if (isAdmin) return "/admin/home";
    if (clientSlug) return `/empresas/${encodeURIComponent(clientSlug)}/home`;
    return "/empresas";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });

      if (res.ok) {
        const meRes = await fetch("/api/me", { credentials: 'include' });
        const meJson = await meRes.json().catch(() => null);
        const authUser = meJson?.user ?? null;
        await refreshUser();
        const nextParam = searchParams?.get("next") ?? null;
        const redirectTo = resolvePostLoginRedirect(nextParam, authUser);
        router.push(redirectTo);
      } else {
        const data = await res.json().catch(() => null);
        setError((data?.error as string) || "Erro ao autenticar");
      }
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={
        styles.loginContainer +
        " " +
        styles.loginFixedTheme +
        " min-h-svh flex items-center justify-center bg-linear-to-br from-[#011848] via-[#f4f6fb] to-[#ef0001] relative isolate z-2147483647 overflow-x-hidden overflow-y-auto px-4 py-6 pointer-events-auto sm:px-6 sm:py-10 md:px-10"
      }
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-6 left-6 w-32 h-32 bg-[#011848] rounded-full opacity-20 blur-2xl animate-ping"></div>
        <div className="absolute bottom-6 right-6 w-28 h-28 bg-[#ef0001] rounded-full opacity-20 blur-2xl animate-pulse"></div>
        <div className="absolute top-1/6 right-1/5 w-20 h-20 bg-[#ef0001] rounded-full opacity-10 blur-lg animate-bounce delay-1000"></div>
        <div className="absolute bottom-1/6 left-1/5 w-24 h-24 bg-[#011848] rounded-full opacity-10 blur-lg animate-pulse delay-700"></div>
        <div className="absolute top-10 left-44 w-16 h-16 bg-[#ef0001] rounded-full opacity-10 blur animate-pulse delay-500"></div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-20 bg-[#011848] rounded-full opacity-10 blur animate-bounce delay-200"></div>
        <div className="absolute top-1/2 left-2 w-14 h-14 bg-[#ef0001] rounded-full opacity-10 blur animate-pulse delay-800"></div>
        <div className="absolute top-1/2 right-2 w-14 h-14 bg-[#011848] rounded-full opacity-10 blur animate-ping delay-600"></div>
      </div>

      <div className="relative z-10 w-full max-w-lg space-y-5 sm:max-w-xl sm:space-y-8 md:max-w-2xl">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-r from-[#011848] to-[#ef0001] shadow-lg sm:h-24 sm:w-24">
            <Image
              src="/images/tc.png"
              alt="Logo Quality Control"
              width={64}
              height={64}
              priority
              className="h-12 w-12 animate-spin-slower select-none object-contain object-center pointer-events-none sm:h-16 sm:w-16"
            />
          </div>
          <h2 className="mb-2 text-3xl font-bold leading-tight text-[#011848] drop-shadow-sm sm:text-4xl">
            Quality Control
          </h2>
          <p className="text-[#011848] font-medium drop-shadow-sm">Bem-vindo, entre na sua conta</p>
        </div>

        <form
          className="mx-auto w-full max-w-sm min-w-0 rounded-2xl border border-[#011848]/10 bg-white/90 p-5 shadow-2xl backdrop-blur-sm sm:max-w-md sm:p-8"
          onSubmit={handleSubmit}
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="user" className="block text-sm font-medium text-[#011848] mb-1">
                Usuário
              </label>
              <input
                id="user"
                name="user"
                type="text"
                required
                className="form-control-user w-full px-4 py-3 border border-[#011848]/20 rounded-lg focus:ring-2 focus:ring-[#ef0001] focus:border-transparent transition-all duration-200 bg-white text-[#011848] placeholder:text-[#9aa3b2] caret-[#ef0001]"
                placeholder="usuário"
                autoComplete="username"
                value={user}
                onChange={(e) => setUser(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#011848] mb-1">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="form-control-user w-full px-4 py-3 border border-[#011848]/20 rounded-lg focus:ring-2 focus:ring-[#ef0001] focus:border-transparent transition-all duration-200 bg-white pr-11 text-[#011848] placeholder:text-[#9aa3b2] caret-[#ef0001]"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 flex items-center text-[#64748b] hover:text-[#011848]"
                  aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                >
                  {showPassword ? <FiEyeOff aria-hidden /> : <FiEye aria-hidden />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full bg-linear-to-r from-[#011848] to-[#ef0001] text-white py-3 px-4 rounded-lg font-medium hover:from-[#011848]/90 hover:to-[#ef0001]/90 focus:ring-2 focus:ring-[#ef0001] focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Entrando...
              </div>
            ) : (
              "Entrar"
            )}
          </button>

          <div className="mt-6 text-sm text-[#4b5563]">
            <div className="flex flex-col items-center gap-2">
              <Link href="/login/forgot-password" className="font-semibold text-[#011848]/90 hover:text-[#011848]">
                Esqueci minha senha
              </Link>
              <div className="flex w-full items-center gap-3 text-xs uppercase tracking-[0.4em] text-[#c1c5d1]">
                <span className="flex-1 h-px bg-linear-to-r from-[#E5E7EB]/0 via-[#E5E7EB] to-[#E5E7EB]/0" />
                <span className="px-1 text-[10px] tracking-[0.35em] text-[#c1c5d1]">OU</span>
                <span className="flex-1 h-px bg-linear-to-r from-[#E5E7EB]/0 via-[#E5E7EB] to-[#E5E7EB]/0" />
              </div>
              <Link href="/login/access-request" className="font-semibold text-[#ef0001] hover:text-[#c70000]">
                Solicitar acesso
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
