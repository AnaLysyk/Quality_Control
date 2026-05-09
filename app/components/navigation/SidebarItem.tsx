"use client";

import Link from "next/link";
import { FiBookmark, FiX } from "react-icons/fi";

type SidebarItemProps = {
  label: string;
  href: string;
  iconKey?: string;
  active?: boolean;
  collapsed?: boolean;
  indent?: boolean;
  onClose?: () => void;
  favoriteId?: string;
  onRemoveFavorite?: (id: string) => void;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
};

export default function SidebarItem({
  label,
  href,
  active = false,
  collapsed = false,
  indent = false,
  onClose,
  favoriteId,
  onRemoveFavorite,
  icon: Icon,
}: SidebarItemProps) {
  const baseClass = `group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
    indent ? "ml-3" : ""
  } ${
    active
      ? "bg-white/16 text-white"
      : "text-white/80 hover:bg-white/10 hover:text-white"
  }`;

  if (collapsed) {
    return (
      <Link
        href={href}
        title={label}
        aria-label={label}
        className={`flex w-full items-center justify-center rounded-xl p-2.5 transition ${
          active ? "bg-white/16 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
        }`}
        onClick={onClose}
      >
        {Icon && <Icon size={18} />}
      </Link>
    );
  }

  return (
    <Link href={href} className={baseClass} onClick={onClose}>
      {Icon && <Icon size={15} className="shrink-0" />}
      <span className="flex-1 truncate">{label}</span>
      {favoriteId && onRemoveFavorite && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemoveFavorite(favoriteId);
          }}
          className="hidden rounded p-0.5 text-white/40 hover:text-white group-hover:flex"
          aria-label="Remover favorito"
          title="Remover favorito"
        >
          <FiX size={12} />
        </button>
      )}
      {!favoriteId && <FiBookmark size={12} className="hidden text-white/30 group-hover:block" />}
    </Link>
  );
}
