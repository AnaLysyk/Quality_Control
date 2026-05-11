"use client";

import Link from "next/link";
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { getIcon } from "./iconRegistry";
import type { NavItemDef, NavModuleDef } from "@/lib/navigation/navigationCatalog";

type SidebarFlyoutProps = {
  mod: NavModuleDef;
  isActive: boolean;
  isItemActive: (item: NavItemDef) => boolean;
  onClose?: () => void;
};

export default function SidebarFlyout({ mod, isActive, isItemActive, onClose }: SidebarFlyoutProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }, [clearClose]);

  const handleButtonMouseEnter = useCallback(() => {
    clearClose();
    setOpen(true);
  }, [clearClose]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const visibleItems = mod.items.filter((item) => item.href);

  if (visibleItems.length === 0 && mod.href) {
    return (
      <Link
        href={mod.href}
        data-testid={mod.testId}
        title={mod.label}
        aria-label={mod.label}
        onClick={onClose}
        className={`flex w-full items-center justify-center rounded-xl p-2 transition ${
          isActive ? "bg-white/16 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
        }`}
      >
        {createElement(getIcon(mod.iconKey), { size: 17 })}
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onMouseEnter={handleButtonMouseEnter}
        onMouseLeave={scheduleClose}
        data-testid={mod.testId}
        title={mod.label}
        aria-label={mod.label}
        className={`flex w-full items-center justify-center rounded-xl p-2 transition ${
          isActive ? "bg-white/16 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
        }`}
      >
        {createElement(getIcon(mod.iconKey), { size: 17 })}
      </button>

      {open && (
        <div
          className="absolute left-19 top-0 z-50 ml-1 min-w-56 max-w-72 overflow-hidden rounded-xl border border-white/15 bg-[#0c1f4a] shadow-2xl"
          onMouseEnter={clearClose}
          onMouseLeave={scheduleClose}
        >
          <div className="border-b border-white/10 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50">{mod.label}</p>
          </div>
          <nav className="p-2">
            {visibleItems.map((item) => {
              const active = isItemActive(item);
              return (
                <Link
                  key={item.id}
                  href={item.href!}
                  data-testid={item.testId}
                  onClick={() => {
                    setOpen(false);
                    onClose?.();
                  }}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                    active ? "bg-white/14 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {createElement(getIcon(item.iconKey), { size: 14, className: "shrink-0 text-white/50" })}
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {visibleItems.length === 0 && (
              <p className="px-3 py-2 text-xs text-white/40">Nenhum item disponível</p>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
