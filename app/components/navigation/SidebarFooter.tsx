"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FiMoon, FiSun } from "react-icons/fi";
import { useAppSettings } from "@/context/AppSettingsContext";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

type SidebarFooterProps = {
  collapsed: boolean;
};

export default function SidebarFooter({ collapsed }: SidebarFooterProps) {
  const { resolvedTheme, setTheme } = useAppSettings();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const Icon = isDark ? FiSun : FiMoon;
  const label = isDark ? "Modo claro" : "Modo escuro";

  const handleToggle = useCallback(() => {
    setTheme(nextTheme);
  }, [nextTheme, setTheme]);

  if (collapsed) {
    return (
      <div className="sidebar-shell-footer flex flex-col items-center gap-1.5 border-t px-1.5 py-2">
        <button
          type="button"
          onClick={handleToggle}
          aria-label={label}
          title={label}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
        >
          {mounted ? <Icon size={14} /> : <FiMoon size={14} />}
        </button>
        <span className="select-none font-mono text-[9px] leading-none text-slate-400">{APP_VERSION}</span>
      </div>
    );
  }

  return (
    <div className="sidebar-shell-footer flex items-center justify-between gap-2 border-t px-3 py-2.5">
      <div className="sidebar-footer-brand flex min-w-0 flex-1 flex-col items-center justify-center text-center">
        <Link
          href="https://www.testingcompany.com.br/"
          target="_blank"
          rel="noopener noreferrer"
          title="Testing Company"
          className="sidebar-footer-company-link truncate text-center text-[8.5px] font-black uppercase tracking-[0.08em] text-slate-500 transition"
        >
          Testing Company
        </Link>
        <span className="sidebar-footer-version select-none truncate text-center font-mono text-[8.5px] leading-tight text-slate-400">
          {APP_VERSION}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 p-0.5">
        <button
          type="button"
          onClick={() => setTheme("light")}
          aria-label="Modo claro"
          title="Modo claro"
          className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
            mounted && !isDark
              ? "bg-white text-slate-950 shadow-sm"
              : "text-slate-500 hover:text-slate-950"
          }`}
        >
          <FiSun size={12} />
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          aria-label="Modo escuro"
          title="Modo escuro"
          className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
            mounted && isDark
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-950"
          }`}
        >
          <FiMoon size={12} />
        </button>
      </div>
    </div>
  );
}
