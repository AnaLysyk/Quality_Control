"use client";

import Link from "next/link";
import { FiBookmark, FiX } from "react-icons/fi";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FavoriteItem } from "@/lib/navigation/favoritesTypes";

type SidebarFavoritesProps = {
  favorites: FavoriteItem[];
  collapsed: boolean;
  onRemove: (id: string) => void;
  pathname: string;
  onClose?: () => void;
};

export default function SidebarFavorites({
  favorites,
  collapsed,
  onRemove,
  pathname,
  onClose,
}: SidebarFavoritesProps) {
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  const clearClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearClose();
    closeTimer.current = setTimeout(() => setFlyoutOpen(false), 150);
  }, [clearClose]);

  useEffect(() => {
    if (!flyoutOpen) return;
    if (!flyoutRef.current) return;
    flyoutRef.current.style.top = `${flyoutTop}px`;
    flyoutRef.current.style.left = "76px";
  }, [flyoutOpen, flyoutTop]);

  if (favorites.length === 0) {
    if (collapsed) return null;
    return null; // Don't show empty section
  }

  if (collapsed) {
    return (
      <div className="relative">
        <button
          ref={buttonRef}
          onMouseEnter={() => {
            clearClose();
            if (buttonRef.current) {
              setFlyoutTop(buttonRef.current.getBoundingClientRect().top);
            }
            setFlyoutOpen(true);
          }}
          onMouseLeave={scheduleClose}
          title="Favoritos"
          aria-label="Favoritos"
          className="flex w-full items-center justify-center rounded-xl p-2.5 text-amber-300/70 transition hover:bg-white/10 hover:text-amber-300"
        >
          <FiBookmark size={18} />
        </button>

        {flyoutOpen && (
          <div
            ref={flyoutRef}
            className="fixed z-50 ml-1 min-w-56 overflow-hidden rounded-xl border border-white/15 bg-[#0c1f4a] shadow-2xl"
            onMouseEnter={clearClose}
            onMouseLeave={scheduleClose}
          >
            <div className="border-b border-white/10 px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-300/70">Favoritos</p>
            </div>
            <nav className="p-2">
              {favorites.map((fav) => (
                <div key={fav.id} className="group flex items-center">
                  <Link
                    href={fav.href}
                    onClick={() => {
                      setFlyoutOpen(false);
                      onClose?.();
                    }}
                    className={`flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                      pathname === fav.href ? "text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <FiBookmark size={13} className="shrink-0 text-amber-300/60" />
                    <span className="truncate">{fav.label}</span>
                  </Link>
                  <button
                    onClick={() => onRemove(fav.id)}
                    className="mr-1 hidden rounded p-1 text-white/30 hover:text-white group-hover:block"
                    aria-label="Remover favorito"
                  >
                    <FiX size={12} />
                  </button>
                </div>
              ))}
            </nav>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-3 pb-2">
      <p className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-amber-300/60">
        <FiBookmark size={10} />
        Favoritos
      </p>
      <div className="space-y-0.5">
        {favorites.map((fav) => (
          <div key={fav.id} className="group flex items-center">
            <Link
              href={fav.href}
              onClick={onClose}
              className={`flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium transition ${
                pathname === fav.href ? "bg-white/14 text-white" : "text-white/75 hover:bg-white/8 hover:text-white"
              }`}
            >
              <FiBookmark size={12} className="shrink-0 text-amber-300/60" />
              <span className="truncate">{fav.label}</span>
            </Link>
            <button
              onClick={() => onRemove(fav.id)}
              className="mr-1 hidden rounded p-0.5 text-white/30 hover:text-white group-hover:block"
              aria-label="Remover favorito"
              title="Remover favorito"
            >
              <FiX size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

