"use client";

/**
 * Profile Header — mostra entidade + status
 */

import { FiUser } from "react-icons/fi";
import { cn } from "@/lib/cn";

export type ProfileHeaderProps = {
  title: string;
  subtitle?: string;
  avatar?: string;
  status?: "active" | "inactive" | "blocked" | "pending" | "archived";
  mode: "self" | "view" | "edit" | "create" | "admin-edit";
};

const statusColors = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-200",
  inactive: "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200",
  blocked: "bg-red-100 text-red-800 dark:bg-red-950/45 dark:text-red-200",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/45 dark:text-yellow-200",
  archived: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

const modeLabels = {
  self: "Meu perfil",
  view: "Visualizando",
  edit: "Editando",
  create: "Novo",
  "admin-edit": "Edição administrativa",
};

export function ProfileHeader({
  title,
  subtitle,
  avatar,
  status,
  mode,
}: ProfileHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef4ff_100%)] text-(--tc-primary,#011848) shadow-[0_14px_28px_rgba(1,24,72,0.12)] dark:border-slate-700/60 dark:bg-[linear-gradient(135deg,#13213a_0%,#0d1b2f_100%)] dark:text-slate-100">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={title} className="h-full w-full object-cover" />
          ) : (
            <FiUser className="h-8 w-8" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-(--tc-text-primary)">{title}</h1>
            {status && (
              <span
                className={cn(
                  "inline-block rounded px-2 py-1 text-xs font-semibold uppercase",
                  statusColors[status],
                )}
              >
                {status}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-(--tc-text-muted)">{subtitle}</p>
          )}
          <p className="text-xs text-(--tc-text-muted) italic">
            {modeLabels[mode]}
          </p>
        </div>
      </div>
    </div>
  );
}
