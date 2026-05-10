"use client";

/**
 * Profile Header — mostra entidade + status
 */

import { cn } from "@/lib/cn";

export type ProfileHeaderProps = {
  title: string;
  subtitle?: string;
  avatar?: string;
  status?: "active" | "inactive" | "blocked" | "pending" | "archived";
  mode: "self" | "view" | "edit" | "create" | "admin-edit";
};

const statusColors = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  blocked: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
  archived: "bg-slate-100 text-slate-800",
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
        {avatar && (
          <img
            src={avatar}
            alt={title}
            className="h-16 w-16 rounded-lg object-cover"
          />
        )}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-tc-text-primary">{title}</h1>
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
            <p className="text-sm text-tc-text-muted">{subtitle}</p>
          )}
          <p className="text-xs text-tc-text-muted italic">
            {modeLabels[mode]}
          </p>
        </div>
      </div>
    </div>
  );
}
