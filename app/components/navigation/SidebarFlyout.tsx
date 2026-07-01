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

function resolveSidebarHref(href: string) {
  if (href === "/suporte/kanban") return "/kanban-it";
  return href;
}

const miniBaseClass =
  "flex w-full items-center justify-center rounded-xl border border-transparent border-l-transparent bg-transparent p-2 text-(--shell-sidebar-text-muted) transition duration-200 hover:border-(--shell-menu-border) hover:border-l-(--tc-accent) hover:bg-white/10 hover:text-(--shell-sidebar-text-strong)";

const flyoutItemClass =
  "flex items-center gap-2.5 rounded-lg border border-transparent border-l-transparent bg-transparent px-3 py-2 text-sm text-(--shell-sidebar-text-muted) transition duration-200 hover:border-(--shell-menu-border) hover:border-l-(--tc-accent) hover:bg-white/10 hover:text-(--shell-sidebar-text-strong)";

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
  const baseClassName = `${miniBaseClass} ${isActive ? "border-l-(--tc-accent) text-(--shell-sidebar-text-strong)" : ""}`;

  if (visibleItems.length === 0 && mod.href) {
    return (
      <Link
        href={resolveSidebarHref(mod.href)}
        data-testid={mod.testId}
        title={mod.label}
        aria-label={mod.label}
        onClick={onClose}
        className={baseClassName}
      >
        {createElement(getIcon(mod.iconKey), { size: 17, className: "text-current" })}
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
        className={baseClassName}
      >
        {createElement(getIcon(mod.iconKey), { size: 17, className: "text-current" })}
      </button>

      {open && (
        <div
          className="absolute left-19 top-0 z-50 ml-1 min-w-56 max-w-72 overflow-hidden rounded-xl border border-(--shell-menu-border) bg-(--tc-surface) text-(--tc-text-primary) shadow-2xl"
          onMouseEnter={clearClose}
          onMouseLeave={scheduleClose}
        >
          <div className="border-b border-(--tc-border) px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-(--tc-text-muted)">{mod.label}</p>
          </div>
          <nav className="p-2">
            {visibleItems.map((item) => {
              const active = isItemActive(item);
              return (
                <Link
                  key={item.id}
                  href={resolveSidebarHref(item.href!)}
                  data-testid={item.testId}
                  onClick={() => {
                    setOpen(false);
                    onClose?.();
                  }}
                  className={`${flyoutItemClass} ${active ? "border-l-(--tc-accent) text-(--shell-sidebar-text-strong)" : ""}`}
                >
                  {createElement(getIcon(item.iconKey), { size: 14, className: "shrink-0 text-current opacity-75" })}
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {visibleItems.length === 0 && (
              <p className="px-3 py-2 text-xs text-(--tc-text-muted)">Nenhum item disponível</p>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
