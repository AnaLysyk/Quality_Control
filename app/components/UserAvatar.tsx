"use client";

import { useMemo, useState } from "react";
import { FiCamera } from "react-icons/fi";

type UserAvatarSize = "sm" | "md" | "lg" | "xl";

const sizeClassMap: Record<UserAvatarSize, string> = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-24 w-24",
  xl: "h-32 w-32",
};

const buttonSizeClassMap: Record<UserAvatarSize, string> = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-9 w-9",
  xl: "h-10 w-10",
};

export function getUserInitials(name?: string | null) {
  const value = (name ?? "").trim();
  if (!value) return "US";
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0]?.slice(0, 1) ?? ""}${parts[parts.length - 1]?.slice(0, 1) ?? ""}`.toUpperCase();
}

export default function UserAvatar({
  src,
  name,
  size = "md",
  showFallback = true,
  editable = false,
  onEdit,
  className = "",
  frameClassName = "",
  imageClassName = "",
  fallbackClassName = "",
  buttonClassName = "",
  buttonLabel = "Alterar foto do perfil",
}: {
  src?: string | null;
  name?: string | null;
  size?: UserAvatarSize;
  showFallback?: boolean;
  editable?: boolean;
  onEdit?: () => void;
  className?: string;
  frameClassName?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  buttonClassName?: string;
  buttonLabel?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const initials = useMemo(() => getUserInitials(name), [name]);
  const normalizedSrc = typeof src === "string" ? src.trim() : "";
  const showImage = Boolean(normalizedSrc) && failedSrc !== normalizedSrc;

  return (
    <div className={`relative ${sizeClassMap[size]} ${className}`}>
      <div
        className={`h-full w-full overflow-hidden rounded-full border border-white/70 bg-linear-to-br from-slate-100 to-slate-200 shadow-[0_14px_30px_rgba(15,23,42,0.16)] ring-1 ring-black/6 dark:from-slate-700 dark:to-slate-800 dark:ring-white/10 ${frameClassName}`}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={normalizedSrc}
            alt={name ? `Foto de ${name}` : "Foto do usuario"}
            className={`block h-full w-full object-cover ${imageClassName}`}
            onError={() => setFailedSrc(normalizedSrc)}
          />
        ) : showFallback ? (
          <span
            className={`flex h-full w-full items-center justify-center bg-transparent text-center text-sm font-bold tracking-[0.18em] text-slate-600 dark:text-slate-100 ${fallbackClassName}`}
            aria-hidden
            suppressHydrationWarning
          >
            {initials}
          </span>
        ) : (
          <span className="block h-full w-full bg-transparent" aria-hidden />
        )}
      </div>

      {editable ? (
        <button
          type="button"
          onClick={onEdit}
          className={`absolute bottom-1 right-1 inline-flex items-center justify-center rounded-full border-2 border-white bg-(--tc-primary) text-white shadow-[0_12px_24px_rgba(15,23,42,0.2)] transition hover:scale-[1.03] hover:bg-(--tc-accent) ${buttonSizeClassMap[size]} ${buttonClassName}`}
          aria-label={buttonLabel}
          title={buttonLabel}
        >
          <FiCamera size={size === "xl" ? 16 : 14} />
        </button>
      ) : null}
    </div>
  );
}
