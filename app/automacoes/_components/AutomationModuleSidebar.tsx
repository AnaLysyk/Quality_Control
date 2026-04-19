"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { FiActivity, FiClipboard, FiCode, FiFolder, FiServer, FiTool } from "react-icons/fi";

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
    <nav className="w-full rounded-[22px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-3 shadow-sm 2xl:sticky 2xl:top-6">
      <div className="flex flex-wrap items-center justify-between gap-3 2xl:block">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">QA IDE</p>
          <p className="mt-1 text-sm text-(--tc-text-secondary,#4b5563)">Troca rápida entre módulos sem sair do workspace.</p>
        </div>
        <span className="inline-flex min-h-9 items-center rounded-full border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--tc-text-muted,#6b7280)">
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
  );
}
