"use client";

import Image from "next/image";
import Link from "next/link";
import { FiChevronsLeft, FiChevronsRight } from "react-icons/fi";

type SidebarHeaderProps = {
  collapsed: boolean;
  onToggle: () => void;
  logoSrc: string;
  logoHref: string;
  onClose?: () => void;
};

export default function SidebarHeader({ collapsed, onToggle, logoSrc, logoHref, onClose }: SidebarHeaderProps) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1.5 border-b border-slate-200 bg-white px-1.5 py-2.5">
        <Link href={logoHref} onClick={onClose} title="Ir para inÃ­cio">
          <div className="relative h-8 w-8 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50">
      <div className="flex flex-col items-center gap-1.5 border-b border-(--shell-sidebar-border) bg-transparent px-1.5 py-2.5">
        <Link href={logoHref} onClick={onClose} title="Ir para início">
          <div className="relative h-8 w-8 overflow-hidden rounded-xl border border-(--shell-sidebar-control-border) bg-(--shell-sidebar-control-bg) shadow-sm transition hover:border-(--shell-menu-border) hover:bg-(--shell-sidebar-control-hover)">
            <Image src={logoSrc} alt="Logo" fill sizes="32px" className="object-contain p-1" />
          </div>
        </Link>
        <button
          onClick={onToggle}
          aria-label="Expandir menu"
          title="Expandir menu"
          className="sidebar-nav-item flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-(--shell-sidebar-text-muted) transition hover:bg-white/10 hover:text-(--shell-sidebar-text-strong)"
        >
          <FiChevronsRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 border-b border-(--shell-sidebar-border) bg-transparent px-3 py-2.5">
      <Link href={logoHref} className="flex min-w-0 items-center gap-2.5" onClick={onClose}>
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-xl border border-(--shell-sidebar-control-border) bg-(--shell-sidebar-control-bg) shadow-sm">
          <Image src={logoSrc} alt="Logo" fill sizes="32px" className="object-contain p-1" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-[9px] uppercase tracking-[0.2em] text-(--shell-sidebar-text-muted)">Testing Company</span>
          <span className="truncate text-[13px] font-semibold text-(--shell-sidebar-text-strong)">Quality Control</span>
        </div>
      </Link>
      <button
        onClick={onToggle}
        aria-label="Recolher menu"
        title="Recolher menu"
        className="sidebar-nav-item flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent text-(--shell-sidebar-text-muted) transition hover:bg-white/10 hover:text-(--shell-sidebar-text-strong)"
      >
        <FiChevronsLeft size={14} />
      </button>
    </div>
  );
}

