"use client";

import { usePathname } from "next/navigation";
import { FiBookmark } from "react-icons/fi";
import { useFavorites } from "@/hooks/navigation/useFavorites";
import type { CreateFavoriteInput, FavoriteType } from "@/lib/navigation/favoritesTypes";

type FavoriteButtonProps = {
  label: string;
  description?: string;
  type?: FavoriteType;
  className?: string;
};

export default function FavoriteButton({
  label,
  description,
  type = "page",
  className = "",
}: FavoriteButtonProps) {
  const pathname = usePathname();
  const { isFavorite, getFavoriteByHref, addFavorite, removeFavorite } = useFavorites();

  const active = isFavorite(pathname);
  const existing = getFavoriteByHref(pathname);

  async function handleClick() {
    if (active && existing) {
      await removeFavorite(existing.id);
    } else {
      const input: CreateFavoriteInput = {
        label,
        description,
        href: pathname,
        type,
      };
      await addFavorite(input);
    }
  }

  return (
    <button
      onClick={handleClick}
      title={active ? "Remover dos favoritos" : "Marcar como favorito"}
      aria-label={active ? "Remover dos favoritos" : "Marcar como favorito"}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
        active
          ? "text-amber-400 hover:text-amber-300"
          : "text-white/40 hover:text-white/70"
      } ${className}`}
    >
      <FiBookmark
        size={14}
        className={active ? "fill-amber-400 text-amber-400" : ""}
      />
      <span className="hidden sm:inline">{active ? "Favoritado" : "Favoritar"}</span>
    </button>
  );
}
