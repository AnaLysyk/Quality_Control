"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createElement, Fragment, useCallback, useState } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import { getIcon } from "./iconRegistry";
import type { NavItemDef, NavModuleDef } from "@/backend/navigation/navigationCatalog";
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

function getVisibleChildren(item: NavItemDef): NavItemDef[] {
  return (item.children ?? []).filter((child) => child.href || getVisibleChildren(child).length > 0);
}

function hasVisibleChildren(item: NavItemDef) {
  return getVisibleChildren(item).length > 0;
}

function itemContainsActive(item: NavItemDef, isItemActive: (item: NavItemDef) => boolean): boolean {
  if (isItemActive(item)) return true;
  return getVisibleChildren(item).some((child) => itemContainsActive(child, isItemActive));
}

const moduleBaseClass =
  "flex w-full min-w-0 items-center gap-3 whitespace-nowrap rounded-xl border border-transparent border-l-transparent bg-transparent px-3 py-2 text-sm font-semibold text-(--shell-sidebar-text-muted) transition duration-200 hover:border-(--shell-menu-border) hover:border-l-(--tc-accent) hover:bg-white/10 hover:text-(--shell-sidebar-text-strong)";

const subItemBaseClass =
  "flex w-full min-w-0 items-center gap-2.5 whitespace-nowrap rounded-lg border border-transparent border-l-transparent bg-transparent px-2 py-1.5 text-[13px] font-medium text-(--shell-sidebar-text-muted) transition duration-200 hover:border-(--shell-menu-border) hover:border-l-(--tc-accent) hover:bg-white/10 hover:text-(--shell-sidebar-text-strong)";

const childItemBaseClass =
  "flex w-full min-w-0 items-center gap-2 whitespace-nowrap rounded-lg border border-transparent border-l-transparent bg-transparent px-2 py-1.5 text-[12px] font-medium text-(--shell-sidebar-text-muted) transition duration-200 hover:border-(--shell-menu-border) hover:border-l-(--tc-accent) hover:bg-white/10 hover:text-(--shell-sidebar-text-strong)";

const selectedClass = "border-l-(--tc-accent) text-(--shell-sidebar-text-strong)";

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
  const [openItemIds, setOpenItemIds] = useState<Set<string>>(new Set());

  const visibleItems = mod.items.filter((item) => item.href || hasVisibleChildren(item));
  const hasChildren = visibleItems.length > 0;
  const highlightModule = isActive && !hasChildren;
  const moduleClassName = [moduleBaseClass, highlightModule ? selectedClass : ""].filter(Boolean).join(" ");

  const prefetchHref = useCallback(
    (href?: string) => {
      if (!href) return;
      try {
        router.prefetch(resolveSidebarHref(href));
      } catch {
        // Prefetch ? apenas otimiza??o. A navega??o normal continua funcionando.
      }
    },
    [router],
  );

  const openSupportTicketModal = useCallback(() => {
    window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_TICKET_MODAL_EVENT));
    onClose?.();
  }, [onClose]);

  const toggleItem = useCallback((itemId: string) => {
    setOpenItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  function renderItem(item: NavItemDef, index: number, siblings: NavItemDef[], level = 0) {
    const children = getVisibleChildren(item);
    const active = itemContainsActive(item, isItemActive);
    const showGroupLabel = level === 0 && item.group && (index === 0 || siblings[index - 1].group !== item.group);
    const Icon = getIcon(item.iconKey);

    if (children.length > 0) {
      const childOpen = openItemIds.has(item.id) || active;
      const parentClassName = [level > 0 ? childItemBaseClass : subItemBaseClass, active ? selectedClass : ""]
        .filter(Boolean)
        .join(" ");

      return (
        <Fragment key={item.id}>
          {showGroupLabel ? (
            <div className="qc-sidebar-group-label max-w-full overflow-hidden px-2 pb-0.5 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-(--shell-sidebar-text-muted) opacity-70">
              <span className="block max-w-full truncate">{item.group}</span>
            </div>
          ) : null}

          <button
            type="button"
            data-testid={item.testId}
            data-active={active ? "true" : undefined}
            aria-expanded={childOpen}
            onClick={() => toggleItem(item.id)}
            className={parentClassName}
          >
            {createElement(Icon, { size: level > 0 ? 12 : 13, className: "shrink-0 text-current opacity-75" })}
            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left">{item.label}</span>
            {childOpen ? (
              <FiChevronDown size={12} className="shrink-0 text-current opacity-55" />
            ) : (
              <FiChevronRight size={12} className="shrink-0 text-current opacity-55" />
            )}
          </button>

          {childOpen ? (
            <div className="ml-3 mt-0.5 min-w-0 space-y-0.5 overflow-hidden border-l border-(--shell-menu-border) pl-2">
              {children.map((child, childIndex) => renderItem(child, childIndex, children, level + 1))}
            </div>
          ) : null}
        </Fragment>
      );
    }

    const href = item.href ? resolveSidebarHref(item.href) : "";
    const openModal = shouldOpenSupportTicketModal(item);
    const itemClassName = [level > 0 ? childItemBaseClass : subItemBaseClass, active ? selectedClass : ""]
      .filter(Boolean)
      .join(" ");

    return (
      <Fragment key={item.id}>
        {showGroupLabel ? (
          <div className="qc-sidebar-group-label max-w-full overflow-hidden px-2 pb-0.5 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-(--shell-sidebar-text-muted) opacity-70">
            <span className="block max-w-full truncate">{item.group}</span>
          </div>
        ) : null}

        {openModal ? (
          <button
            type="button"
            data-testid={item.testId}
            data-active={active ? "true" : undefined}
            aria-current={active ? "page" : undefined}
            onClick={openSupportTicketModal}
            className={itemClassName}
          >
            {createElement(Icon, { size: level > 0 ? 12 : 13, className: "shrink-0 text-current opacity-75" })}
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
            className={itemClassName}
          >
            {createElement(Icon, { size: level > 0 ? 12 : 13, className: "shrink-0 text-current opacity-75" })}
            <span className="min-w-0 truncate whitespace-nowrap">{item.label}</span>
          </Link>
        )}
      </Fragment>
    );
  }

  if (!hasChildren && mod.href) {
    const href = resolveSidebarHref(mod.href);
    return (
      <Link
        href={href}
        prefetch={false}
        data-testid={mod.testId}
        data-active={highlightModule ? "true" : undefined}
        aria-current={highlightModule ? "page" : undefined}
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
    <div className="relative min-w-0 overflow-hidden">
      <button
        onClick={onToggle}
        data-testid={mod.testId}
        data-active={undefined}
        className={moduleBaseClass}
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
        <div className="ml-4 mt-0.5 min-w-0 space-y-0.5 overflow-hidden border-l border-(--shell-menu-border) pl-3">
          {visibleItems.map((item, index) => renderItem(item, index, visibleItems))}
        </div>
      )}
    </div>
  );
}
