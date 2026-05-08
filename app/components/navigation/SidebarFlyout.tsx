"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [top, setTop] = useState(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTop(rect.top);
    }
    setOpen(true);
  }, [clearClose]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const ModuleIcon = getIcon(mod.iconKey);
  const visibleItems = mod.items.filter((item) => item.href);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onMouseEnter={handleButtonMouseEnter}
        onMouseLeave={scheduleClose}
        title={mod.label}
        aria-label={mod.label}
        className={`flex w-full items-center justify-center rounded-xl p-2 transition ${
          isActive ? "bg-white/16 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
        }`}
      >
        <ModuleIcon size={17} />
      </button>

      {open && (
        <div
          className="fixed z-50 ml-1 min-w-56 max-w-72 overflow-hidden rounded-xl border border-white/15 bg-[#0c1f4a] shadow-2xl [left:76px]"
          style={{ top: `${top}px` }}
          onMouseEnter={clearClose}
          onMouseLeave={scheduleClose}
        >
          <div className="border-b border-white/10 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50">{mod.label}</p>
          </div>
          <nav className="p-2">
            {visibleItems.map((item) => {
              const ItemIcon = getIcon(item.iconKey);
              const active = isItemActive(item);
              return (
                <Link
                  key={item.id}
                  href={item.href!}
                  onClick={() => {
                    setOpen(false);
                    onClose?.();
                  }}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                    active ? "bg-white/14 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <ItemIcon size={14} className="flex-shrink-0 text-white/50" />
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
