"use client";

import Link from "next/link";
import { createElement, Fragment } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import { getIcon } from "./iconRegistry";
import type { NavItemDef, NavModuleDef } from "@/lib/navigation/navigationCatalog";

type SidebarSectionProps = {
  mod: NavModuleDef;
  isActive: boolean;
  isItemActive: (item: NavItemDef) => boolean;
  open: boolean;
  onToggle: () => void;
  onClose?: () => void;
};

function resolveSidebarHref(href: string) {
  if (href === "/suporte/kanban") return "/kanban-it";
  return href;
}

const moduleBaseClass =
  "flex w-full items-center gap-3 rounded-xl border border-transparent border-l-transparent bg-transparent px-3 py-2 text-sm font-semibold text-(--shell-sidebar-text-muted) transition duration-200 hover:border-(--shell-menu-border) hover:border-l-(--tc-accent) hover:bg-white/10 hover:text-(--shell-sidebar-text-strong)";

const subItemBaseClass =
  "flex items-center gap-2.5 rounded-lg border border-transparent border-l-transparent bg-transparent px-2 py-1.5 text-[13px] font-medium text-(--shell-sidebar-text-muted) transition duration-200 hover:border-(--shell-menu-border) hover:border-l-(--tc-accent) hover:bg-white/10 hover:text-(--shell-sidebar-text-strong)";

export default function SidebarSection({
  mod,
  isActive,
  isItemActive,
  open,
  onToggle,
  onClose,
}: SidebarSectionProps) {
  const visibleItems = mod.items.filter((item) => item.href);
  const hasChildren = visibleItems.length > 0;
  const moduleClassName = `${moduleBaseClass} ${isActive ? "border-l-(--tc-accent) text-(--shell-sidebar-text-strong)" : ""}`;

  if (!hasChildren && mod.href) {
    return (
      <Link
        href={resolveSidebarHref(mod.href)}
        data-testid={mod.testId}
        onClick={onClose}
        className={moduleClassName}
      >
        {createElement(getIcon(mod.iconKey), { size: 16, className: "shrink-0 text-current" })}
        <span className="flex-1 truncate text-left">{mod.label}</span>
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={onToggle}
        data-testid={mod.testId}
        className={moduleClassName}
      >
        {createElement(getIcon(mod.iconKey), { size: 16, className: "shrink-0 text-current" })}
        <span className="flex-1 truncate text-left">{mod.label}</span>
        {open ? (
          <FiChevronDown size={13} className="shrink-0 text-current opacity-55" />
        ) : (
          <FiChevronRight size={13} className="shrink-0 text-current opacity-55" />
        )}
      </button>

      {open && visibleItems.length > 0 && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-(--shell-menu-border) pl-3">
          {visibleItems.map((item, index) => {
            const active = isItemActive(item);
            const showGroupLabel = item.group && (index === 0 || visibleItems[index - 1].group !== item.group);
            return (
              <Fragment key={item.id}>
                {showGroupLabel && (
                  <span className="block px-2 pb-0.5 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-(--shell-sidebar-text-muted) opacity-70">
                    {item.group}
                  </span>
                )}
                <Link
                  href={resolveSidebarHref(item.href!)}
                  data-testid={item.testId}
                  onClick={onClose}
                  className={`${subItemBaseClass} ${active ? "border-l-(--tc-accent) text-(--shell-sidebar-text-strong)" : ""}`}
                >
                  {createElement(getIcon(item.iconKey), { size: 13, className: "shrink-0 text-current opacity-75" })}
                  <span className="truncate">{item.label}</span>
                </Link>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
