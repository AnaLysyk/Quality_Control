"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createElement, Fragment, useCallback } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import { getIcon } from "./iconRegistry";
import type { NavItemDef, NavModuleDef } from "@/lib/navigation/navigationCatalog";
import { OPEN_SUPPORT_TICKET_MODAL_EVENT } from "@/components/CreateSupportTicketButton";

type SidebarSectionProps = {
  mod: NavModuleDef;
  isActive: boolean;
  isItemActive: (item: NavItemDef) => boolean;
  open: boolean;
  onToggle: () => void;
  onClose?: () => void;
  badgeLabel?: string;
};

function resolveSidebarHref(href: string) {
  if (href === "/suporte/kanban") return "/kanban-it";
  return href;
}

function shouldOpenSupportTicketModal(item: NavItemDef) {
  return item.id === "support-create" || item.routeId === "suporte.criar";
}

const moduleBaseClass =
  "flex w-full min-w-0 items-center gap-3 whitespace-nowrap rounded-xl border border-transparent border-l-transparent bg-transparent px-3 py-2 text-sm font-semibold text-(--shell-sidebar-text-muted) transition duration-200 hover:border-(--shell-menu-border) hover:border-l-(--tc-accent) hover:bg-white/10 hover:text-(--shell-sidebar-text-strong)";

const subItemBaseClass =
  "flex w-full min-w-0 items-center gap-2.5 whitespace-nowrap rounded-lg border border-transparent border-l-transparent bg-transparent px-2 py-1.5 text-[13px] font-medium text-(--shell-sidebar-text-muted) transition duration-200 hover:border-(--shell-menu-border) hover:border-l-(--tc-accent) hover:bg-white/10 hover:text-(--shell-sidebar-text-strong)";

export default function SidebarSection({
  mod,
  isActive,
  isItemActive,
  open,
  onToggle,
  onClose,
  badgeLabel = "",
}: SidebarSectionProps) {
  const router = useRouter();
  const visibleItems = mod.items.filter((item) => item.href);
  const hasChildren = visibleItems.length > 0;
  const moduleClassName = `${moduleBaseClass} ${isActive ? "border-l-(--tc-accent) text-(--shell-sidebar-text-strong)" : ""}`;

  const prefetchHref = useCallback(
    (href?: string) => {
      if (!href) return;
      try {
        router.prefetch(resolveSidebarHref(href));
      } catch {
        // Prefetch é apenas otimização. A navegação normal continua funcionando.
      }
    },
    [router],
  );

  const openSupportTicketModal = useCallback(() => {
    window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_TICKET_MODAL_EVENT));
    onClose?.();
  }, [onClose]);

  if (!hasChildren && mod.href) {
    const href = resolveSidebarHref(mod.href);
    return (
      <Link
        href={href}
        prefetch={false}
        data-testid={mod.testId}
        data-active={isActive ? "true" : undefined}
        aria-current={isActive ? "page" : undefined}
        onClick={onClose}
        onPointerEnter={() => prefetchHref(mod.href)}
        onPointerDown={() => prefetchHref(mod.href)}
        onFocus={() => prefetchHref(mod.href)}
        className={moduleClassName}
      >
        {createElement(getIcon(mod.iconKey), { size: 16, className: "shrink-0 text-current" })}
        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left">{mod.label}</span>
        {badgeLabel ? <span className="qc-sidebar-chat-badge">{badgeLabel}</span> : null}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={onToggle}
        data-testid={mod.testId}
        data-active={isActive ? "true" : undefined}
        className={moduleClassName}
      >
        {createElement(getIcon(mod.iconKey), { size: 16, className: "shrink-0 text-current" })}
        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left">{mod.label}</span>
        {badgeLabel ? <span className="qc-sidebar-chat-badge">{badgeLabel}</span> : null}
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
            const href = resolveSidebarHref(item.href!);
            const openModal = shouldOpenSupportTicketModal(item);
            const Icon = getIcon(item.iconKey);
            return (
              <Fragment key={item.id}>
                {showGroupLabel && (
                  <span className="block px-2 pb-0.5 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-(--shell-sidebar-text-muted) opacity-70">
                    {item.group}
                  </span>
                )}
                {openModal ? (
                  <button
                    type="button"
                    data-testid={item.testId}
                    onClick={openSupportTicketModal}
                    className={`${subItemBaseClass} ${active ? "border-l-(--tc-accent) text-(--shell-sidebar-text-strong)" : ""}`}
                  >
                    {createElement(Icon, { size: 13, className: "shrink-0 text-current opacity-75" })}
                    <span className="min-w-0 truncate whitespace-nowrap">{item.label}</span>
                  </button>
                ) : (
                  <Link
                    href={href}
                    prefetch={false}
                    data-testid={item.testId}
                    data-active={active ? "true" : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={onClose}
                    onPointerEnter={() => prefetchHref(item.href)}
                    onPointerDown={() => prefetchHref(item.href)}
                    onFocus={() => prefetchHref(item.href)}
                    className={`${subItemBaseClass} ${active ? "border-l-(--tc-accent) text-(--shell-sidebar-text-strong)" : ""}`}
                  >
                    {createElement(Icon, { size: 13, className: "shrink-0 text-current opacity-75" })}
                    <span className="min-w-0 truncate whitespace-nowrap">{item.label}</span>
                  </Link>
                )}
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
