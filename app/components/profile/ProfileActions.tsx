"use client";

/**
 * Profile Actions — botões de ação contextuais
 */

import { ReactNode } from "react";
import { useProfileAction, useDangerZone, useProfileMode } from "@/lib/profile/useProfileContext";
import { cn } from "@/lib/cn";

export type ProfileActionButton = {
  label: string;
  action:
    | "edit"
    | "save"
    | "cancel"
    | "delete"
    | "deactivate"
    | "archive"
    | "manage_users"
    | "manage_permissions"
    | "manage_links"
    | "manage_integrations"
    | "view_audit"
    | "impersonate"
    | "block"
    | "reset_password"
    | "resend_invite"
    | "custom";
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
};

export function ProfileActions({
  buttons,
}: {
  buttons: ProfileActionButton[];
}) {
  const dangerZone = useDangerZone();
  const mode = useProfileMode();
  const canEdit = useProfileAction("edit");

  const visible = buttons.filter((btn) => {
    if (btn.action === "custom") return true;

    // Verificar permissão
    const actionMap = {
      edit: () => canEdit,
      save: () => mode === "edit" || mode === "admin-edit" || mode === "create",
      cancel: () => mode === "edit" || mode === "admin-edit",
      delete: () => dangerZone && useProfileAction("delete"),
      deactivate: () => dangerZone && useProfileAction("deactivate"),
      archive: () => dangerZone && useProfileAction("archive"),
      manage_users: () => useProfileAction("manage_users"),
      manage_permissions: () => useProfileAction("manage_permissions"),
      manage_links: () => useProfileAction("manage_links"),
      manage_integrations: () => useProfileAction("manage_integrations"),
      view_audit: () => useProfileAction("view_audit"),
      impersonate: () => useProfileAction("impersonate"),
      block: () => useProfileAction("block"),
      reset_password: () => useProfileAction("reset_password"),
      resend_invite: () => useProfileAction("resend_invite"),
    };

    const checkFn = actionMap[btn.action as keyof typeof actionMap];
    return checkFn ? checkFn() : true;
  });

  return (
    <div className="flex items-center gap-2">
      {visible.map((btn, idx) => (
        <button
          key={idx}
          onClick={btn.onClick}
          disabled={btn.disabled || btn.loading}
          className={cn(
            "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition",
            btn.variant === "danger"
              ? "bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50"
              : btn.variant === "secondary"
                ? "bg-tc-surface text-tc-text-primary hover:bg-tc-surface-hover disabled:opacity-50"
                : "bg-tc-accent text-white hover:bg-tc-accent-hover disabled:opacity-50",
          )}
        >
          {btn.loading && (
            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {btn.label}
        </button>
      ))}
    </div>
  );
}
