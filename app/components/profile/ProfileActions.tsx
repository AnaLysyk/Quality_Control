"use client";

/**
 * Profile Actions — botões de ação contextuais
 */

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
  const canDelete = useProfileAction("delete");
  const canDeactivate = useProfileAction("deactivate");
  const canArchive = useProfileAction("archive");
  const canManageUsers = useProfileAction("manage_users");
  const canManagePermissions = useProfileAction("manage_permissions");
  const canManageLinks = useProfileAction("manage_links");
  const canManageIntegrations = useProfileAction("manage_integrations");
  const canViewAudit = useProfileAction("view_audit");
  const canImpersonate = useProfileAction("impersonate");
  const canBlock = useProfileAction("block");
  const canResetPassword = useProfileAction("reset_password");
  const canResendInvite = useProfileAction("resend_invite");

  const actionPermissions: Record<Exclude<ProfileActionButton["action"], "custom">, boolean> = {
    edit: canEdit,
    save: mode === "edit" || mode === "admin-edit" || mode === "create",
    cancel: mode === "edit" || mode === "admin-edit",
    delete: dangerZone && canDelete,
    deactivate: dangerZone && canDeactivate,
    archive: dangerZone && canArchive,
    manage_users: canManageUsers,
    manage_permissions: canManagePermissions,
    manage_links: canManageLinks,
    manage_integrations: canManageIntegrations,
    view_audit: canViewAudit,
    impersonate: canImpersonate,
    block: canBlock,
    reset_password: canResetPassword,
    resend_invite: canResendInvite,
  };

  const visible = buttons.filter((btn) => {
    if (btn.action === "custom") return true;
    return actionPermissions[btn.action] ?? true;
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
              ? "bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50 dark:bg-red-950/45 dark:text-red-200 dark:hover:bg-red-950/65"
              : btn.variant === "secondary"
                ? "border border-(--tc-border) bg-(--tc-surface) text-(--tc-text-primary) hover:bg-(--tc-surface-hover) disabled:opacity-50"
                : "bg-(--tc-accent) text-white hover:bg-(--tc-accent-hover) disabled:opacity-50",
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

