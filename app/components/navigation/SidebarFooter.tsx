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
      <div className="border-t border-white/10 px-1.5 py-2 flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={handleToggle}
          aria-label={label}
          title={label}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          {mounted ? <Icon size={14} /> : <FiMoon size={14} />}
        </button>
        <span className="text-[9px] font-mono text-white/20 leading-none select-none">{APP_VERSION}</span>
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 px-3 py-2.5 flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-col">
        <Link
          href="https://www.testingcompany.com.br/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60 truncate hover:text-white/90 transition"
        >
          Testing Company
        </Link>
        <span className="text-[10px] font-mono text-white/30 leading-tight select-none">
          {APP_VERSION}
        </span>
      </div>

      {/* Theme toggle: pill com claro/escuro */}
      <div className="flex-shrink-0 flex items-center gap-0.5 rounded-full border border-white/15 bg-white/8 p-0.5">
        <button
          type="button"
          onClick={() => setTheme("light")}
          aria-label="Modo claro"
          title="Modo claro"
          className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
            mounted && !isDark
              ? "bg-white/90 text-[#011848] shadow-sm"
              : "text-white/50 hover:text-white"
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
              ? "bg-white/20 text-white shadow-sm"
              : "text-white/50 hover:text-white"
          }`}
        >
          <FiMoon size={12} />
        </button>
      </div>
    </div>
  );
}
