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
  const baseClassName = `sidebar-mini-entry ${isActive ? "sidebar-mini-entry--active" : ""}`;

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
        {createElement(getIcon(mod.iconKey), { size: 17, className: "sidebar-nav-icon" })}
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
        {createElement(getIcon(mod.iconKey), { size: 17, className: "sidebar-nav-icon" })}
      </button>

      {open && (
        <div
          className="sidebar-flyout-panel absolute left-19 top-0 z-50 ml-1 min-w-56 max-w-72 overflow-hidden rounded-xl border shadow-2xl"
          onMouseEnter={clearClose}
          onMouseLeave={scheduleClose}
        >
          <div className="sidebar-flyout-header border-b px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-widest">{mod.label}</p>
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
                  className={`sidebar-flyout-item ${active ? "sidebar-flyout-item--active" : ""}`}
                >
                  {createElement(getIcon(item.iconKey), { size: 14, className: "shrink-0 sidebar-nav-icon" })}
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {visibleItems.length === 0 && (
              <p className="px-3 py-2 text-xs text-(--shell-sidebar-text-muted)">Nenhum item disponível</p>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
