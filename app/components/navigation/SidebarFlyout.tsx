"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { getIcon } from "./iconRegistry";
import type { NavItemDef, NavModuleDef } from "@/lib/navigation/navigationCatalog";
import { OPEN_SUPPORT_TICKET_MODAL_EVENT } from "@/components/CreateSupportTicketButton";

type SidebarFlyoutProps = {
  mod: NavModuleDef;
  isActive: boolean;
  isItemActive: (item: NavItemDef) => boolean;
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

const miniBaseClass =
  "flex w-full min-w-0 items-center justify-center whitespace-nowrap rounded-xl border border-transparent border-l-transparent bg-transparent p-2 text-(--shell-sidebar-text-muted) transition duration-200 hover:border-(--shell-menu-border) hover:border-l-(--tc-accent) hover:bg-white/10 hover:text-(--shell-sidebar-text-strong)";

const flyoutItemClass =
  "flex w-full min-w-0 items-center gap-2.5 whitespace-nowrap rounded-lg border border-transparent border-l-transparent bg-transparent px-3 py-2 text-sm text-(--shell-sidebar-text-muted) transition duration-200 hover:border-(--shell-menu-border) hover:border-l-(--tc-accent) hover:bg-white/10 hover:text-(--shell-sidebar-text-strong)";

export default function SidebarFlyout({ mod, isActive, isItemActive, onClose, badgeLabel = "" }: SidebarFlyoutProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (mod.href) prefetchHref(mod.href);
  }, [clearClose, mod.href, prefetchHref]);

  const openSupportTicketModal = useCallback(() => {
    window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_TICKET_MODAL_EVENT));
    setOpen(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const visibleItems = mod.items.filter((item) => item.href);
  const baseClassName = `${miniBaseClass} ${isActive ? "border-l-(--tc-accent) text-(--shell-sidebar-text-strong)" : ""}`;

  if (visibleItems.length === 0 && mod.href) {
    const href = resolveSidebarHref(mod.href);
    return (
      <Link
        href={href}
        prefetch={false}
        data-testid={mod.testId}
        title={mod.label}
        aria-label={mod.label}
        data-active={isActive ? "true" : undefined}
        aria-current={isActive ? "page" : undefined}
        onClick={onClose}
        onPointerEnter={() => prefetchHref(mod.href)}
        onPointerDown={() => prefetchHref(mod.href)}
        onFocus={() => prefetchHref(mod.href)}
        className={`${baseClassName} relative`}
      >
        {createElement(getIcon(mod.iconKey), { size: 17, className: "text-current" })}
        {badgeLabel ? <span className="qc-sidebar-chat-badge qc-sidebar-chat-badge--mini">{badgeLabel}</span> : null}
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
        data-active={isActive ? "true" : undefined}
        className={`${baseClassName} relative`}
      >
        {createElement(getIcon(mod.iconKey), { size: 17, className: "text-current" })}
        {badgeLabel ? <span className="qc-sidebar-chat-badge qc-sidebar-chat-badge--mini">{badgeLabel}</span> : null}
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
              const href = resolveSidebarHref(item.href!);
              const openModal = shouldOpenSupportTicketModal(item);
              const Icon = getIcon(item.iconKey);
              return openModal ? (
                <button
                  key={item.id}
                  type="button"
                  data-testid={item.testId}
                  onClick={openSupportTicketModal}
                  className={`${flyoutItemClass} ${active ? "border-l-(--tc-accent) text-(--shell-sidebar-text-strong)" : ""}`}
                >
                  {createElement(Icon, { size: 14, className: "shrink-0 text-current opacity-75" })}
                  <span className="min-w-0 truncate whitespace-nowrap">{item.label}</span>
                </button>
              ) : (
                <Link
                  key={item.id}
                  href={href}
                  prefetch={false}
                  data-testid={item.testId}
                  data-active={active ? "true" : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    setOpen(false);
                    onClose?.();
                  }}
                  onPointerEnter={() => prefetchHref(item.href)}
                  onPointerDown={() => prefetchHref(item.href)}
                  onFocus={() => prefetchHref(item.href)}
                  className={`${flyoutItemClass} ${active ? "border-l-(--tc-accent) text-(--shell-sidebar-text-strong)" : ""}`}
                >
                  {createElement(Icon, { size: 14, className: "shrink-0 text-current opacity-75" })}
                  <span className="min-w-0 truncate whitespace-nowrap">{item.label}</span>
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
