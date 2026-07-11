"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { FiActivity, FiClipboard, FiCode, FiFolder, FiSend } from "react-icons/fi";

type NavItem = {
  href: string;
  icon: typeof FiSend;
  label: string;
};

// Operação do dia a dia fica só com Postman + IDE. As demais telas continuam
// existindo (links diretos, deep links de Casos etc.) mas saíram do menu
// principal para reduzir a quantidade de cards.
const NAV_ITEMS: NavItem[] = [
  { href: "/automacoes/api-lab", icon: FiSend, label: "Postman" },
  { href: "/automacoes/playwright", icon: FiCode, label: "IDE" },
];

const UTILITY_ITEMS: NavItem[] = [
  { href: "/automacoes/base64?tab=library", icon: FiFolder, label: "Biblioteca Base64" },
  { href: "/casos-de-teste", icon: FiClipboard, label: "Casos" },
  { href: "/automacoes/execucoes", icon: FiActivity, label: "Runs" },
];

export default function AutomationModuleSidebar() {
  const pathname = usePathname();
  const router = useRouter();
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
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      for (const item of NAV_ITEMS) {
        prefetchHref(item.href);
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [prefetchHref]);

  return (
    <nav className="w-full rounded-[22px] border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface,#ffffff)] p-3 shadow-sm 2xl:sticky 2xl:top-6">
      <div className="flex flex-wrap items-center justify-between gap-3 2xl:block">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--tc-text-muted,#6b7280)]">QA IDE</p>
          <p className="mt-1 text-sm text-[var(--tc-text-secondary,#4b5563)]">Troca rápida entre módulos sem sair do workspace.</p>
        </div>
        <span className="inline-flex min-h-9 items-center rounded-full border border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--tc-text-muted,#6b7280)]">
          {NAV_ITEMS.length} áreas
        </span>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 2xl:flex-col 2xl:overflow-visible 2xl:pb-0">
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
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border-[var(--tc-accent,#ef0001)] bg-[#fff5f5] text-[var(--tc-accent,#ef0001)]"
                  : "border-[var(--tc-border,#d7deea)] bg-[var(--tc-surface-2,#f8fafc)] text-[var(--tc-text,#0b1a3c)] hover:border-[var(--tc-accent,#ef0001)]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 border-t border-[var(--tc-border,#d7deea)] pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--tc-text-muted,#6b7280)]">Outras ferramentas</p>
        <div className="mt-2 flex flex-wrap gap-2 2xl:flex-col">
          {UTILITY_ITEMS.map((item) => {
            const [itemPath] = item.href.split("?");
            const isActive = pathname === itemPath || pathname.startsWith(`${itemPath}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                scroll={false}
                className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "border-[var(--tc-accent,#ef0001)] text-[var(--tc-accent,#ef0001)]"
                    : "border-[var(--tc-border,#d7deea)] text-[var(--tc-text-secondary,#4b5563)] hover:border-[var(--tc-accent,#ef0001)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

