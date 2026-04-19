"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiActivity, FiClipboard, FiCode, FiFolder, FiList, FiMenu, FiServer, FiTool, FiX } from "react-icons/fi";

type NavItem = {
  href: string;
  icon: typeof FiTool;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/automacoes/tools", icon: FiTool, label: "Tools" },
  { href: "/automacoes/api-lab", icon: FiServer, label: "API Lab" },
  { href: "/automacoes/ui-studio", icon: FiCode, label: "UI Studio" },
  { href: "/automacoes/casos", icon: FiClipboard, label: "Casos" },
  { href: "/automacoes/arquivos", icon: FiFolder, label: "Assets" },
  { href: "/automacoes/execucoes", icon: FiActivity, label: "Runs" },
  { href: "/automacoes/logs", icon: FiList, label: "Logs" },
];

export default function AutomationModuleSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());

  const prefetchHref = useCallback(
    (href: string) => {
      if (!href || href === pathname || prefetchedRoutesRef.current.has(href)) return;
      prefetchedRoutesRef.current.add(href);
      try {
        router.prefetch(href);
      } catch {
        prefetchedRoutesRef.current.delete(href);
      }
    },
    [pathname, router],
  );

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      for (const item of NAV_ITEMS) {
        prefetchHref(item.href);
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [prefetchHref]);

  return (
    <div className="fixed bottom-4 left-1/2 z-60 -translate-x-1/2 sm:bottom-6">
      {isOpen ? <div className="fixed inset-0 z-30 bg-transparent" onClick={() => setIsOpen(false)} /> : null}
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Fechar menu de automação" : "Abrir menu de automação"}
        title={isOpen ? "Fechar menu de automação" : "Abrir menu de automação"}
        className="relative z-60 flex h-12 w-12 items-center justify-center rounded-full border border-white/35 bg-[radial-gradient(circle_at_30%_30%,#f3f4f6_0%,#6b7280_35%,#111827_100%)] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_0_18px_rgba(17,24,39,0.35),0_10px_30px_rgba(15,23,42,0.2)] transition duration-200 hover:scale-105 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.25),0_0_28px_rgba(17,24,39,0.55),0_12px_34px_rgba(15,23,42,0.24)] focus:outline-none focus:ring-2 focus:ring-white/80 focus:ring-offset-2 focus:ring-offset-(--page-bg,#f3f6fb)"
      >
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0)_65%)] opacity-70 blur-[1px] animate-pulse" />
        <span className="absolute -inset-1.5 rounded-full border border-white/20 shadow-[0_0_24px_rgba(17,24,39,0.4)] animate-ping motion-reduce:animate-none" />
        {isOpen ? <FiX className="relative z-10 h-5 w-5 drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]" /> : <FiMenu className="relative z-10 h-5 w-5 drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]" />}
      </button>

      {isOpen ? (
        <nav className="absolute bottom-full left-1/2 z-60 mb-8 w-[min(21rem,calc(100vw-2rem))] -translate-x-1/2 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-3xl border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-3 shadow-[0_24px_70px_rgba(2,6,23,0.2)]">
          <div className="flex items-center justify-between gap-3 border-b border-(--tc-border,#e5e7eb) pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">QA IDE</p>
              <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Troca rápida entre módulos.</p>
            </div>
            <span className="inline-flex min-h-8 items-center rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
              {NAV_ITEMS.length} áreas
            </span>
          </div>

          <div className="mt-3 grid gap-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  scroll={false}
                  prefetch
                  onMouseEnter={() => prefetchHref(item.href)}
                  onFocus={() => prefetchHref(item.href)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "border-(--tc-accent,#ef0001) bg-[#fff5f5] text-(--tc-accent,#ef0001)"
                      : "border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) text-(--tc-text,#0b1a3c) hover:border-(--tc-accent,#ef0001)"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
