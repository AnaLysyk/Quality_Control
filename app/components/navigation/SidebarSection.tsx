"use client";

import Link from "next/link";
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
  const ModuleIcon = getIcon(mod.iconKey);
  const visibleItems = mod.items.filter((item) => item.href);

  return (
    <div>
      <button
        onClick={onToggle}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
          isActive
            ? "text-white"
            : "text-white/60 hover:bg-white/10 hover:text-white"
        }`}
      >
        <ModuleIcon size={16} className="shrink-0" />
        <span className="flex-1 truncate text-left">{mod.label}</span>
        {open ? (
          <FiChevronDown size={13} className="shrink-0 text-white/40" />
        ) : (
          <FiChevronRight size={13} className="shrink-0 text-white/40" />
        )}
      </button>

      {open && visibleItems.length > 0 && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
          {visibleItems.map((item) => {
            const ItemIcon = getIcon(item.iconKey);
            const active = isItemActive(item);
            return (
              <Link
                key={item.id}
                href={item.href!}
                onClick={onClose}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] font-medium transition ${
                  active
                    ? "bg-white/14 text-white"
                    : "text-white/70 hover:bg-white/8 hover:text-white"
                }`}
              >
                <ItemIcon size={13} className="shrink-0 text-white/50" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
