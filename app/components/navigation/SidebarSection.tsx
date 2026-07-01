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
  const moduleClassName = `sidebar-nav-entry ${isActive ? "sidebar-nav-entry--active" : ""}`;

  if (!hasChildren && mod.href) {
    return (
      <Link
        href={mod.href}
        data-testid={mod.testId}
        onClick={onClose}
        className={moduleClassName}
      >
        {createElement(getIcon(mod.iconKey), { size: 16, className: "shrink-0 sidebar-nav-icon" })}
        <span className="flex-1 truncate text-left">{mod.label}</span>
      </Link>
    );
  }

  return (
    <div className="sidebar-nav-group">
      <button
        onClick={onToggle}
        data-testid={mod.testId}
        className={moduleClassName}
      >
        {createElement(getIcon(mod.iconKey), { size: 16, className: "shrink-0 sidebar-nav-icon" })}
        <span className="flex-1 truncate text-left">{mod.label}</span>
        {open ? (
          <FiChevronDown size={13} className="shrink-0 sidebar-nav-chevron" />
        ) : (
          <FiChevronRight size={13} className="shrink-0 sidebar-nav-chevron" />
        )}
      </button>

      {open && visibleItems.length > 0 && (
        <div className="sidebar-nav-children ml-4 mt-0.5 space-y-0.5 border-l pl-3">
          {visibleItems.map((item, index) => {
            const active = isItemActive(item);
            const showGroupLabel = item.group && (index === 0 || visibleItems[index - 1].group !== item.group);
            return (
              <Fragment key={item.id}>
                {showGroupLabel && (
                  <span className="sidebar-nav-group-label block px-2 pb-0.5 pt-2.5 text-[10px] font-semibold uppercase tracking-widest">
                    {item.group}
                  </span>
                )}
                <Link
                  href={item.href!}
                  data-testid={item.testId}
                  onClick={onClose}
                  className={`sidebar-nav-subentry ${active ? "sidebar-nav-subentry--active" : ""}`}
                >
                  {createElement(getIcon(item.iconKey), { size: 13, className: "shrink-0 sidebar-nav-icon" })}
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
