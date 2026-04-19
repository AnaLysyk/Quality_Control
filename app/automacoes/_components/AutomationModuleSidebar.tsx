"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <nav className="rounded-[18px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-3 shadow-sm lg:sticky lg:top-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--tc-text-muted,#6b7280)">QA IDE</p>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
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
