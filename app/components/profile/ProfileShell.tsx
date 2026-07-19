"use client";

/**
 * Profile Shell — container da tela de perfil
 * Renderiza header, tabs, ações e conteúdo
 */

import { ReactNode } from "react";
import { ProfileProvider, useProfileContext } from "@/backend/profile/useProfileContext";
import type { ProfileRuntimeContext } from "@/backend/profile/types";

export function ProfileShell({
  context,
  header,
  tabs,
  actions,
  children,
}: {
  context: ProfileRuntimeContext;
  header: ReactNode;
  tabs: ReactNode;
  actions: ReactNode;
  children?: ReactNode;
}) {
  return (
    <ProfileProvider context={context}>
      <div className="flex flex-col gap-6 py-6 text-(--tc-text-primary)">
        {/* Header */}
        <div className="border-b border-(--tc-border) pb-6">{header}</div>

        {/* Tabs + Actions */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">{tabs}</div>
            <div className="flex gap-2">{actions}</div>
          </div>
        </div>

        {/* Content */}
        <div className="py-4">{children}</div>
      </div>
    </ProfileProvider>
  );
}

/**
 * Internal renderer para conteúdo
 */
export function ProfileShellContent({
  tab,
  children,
}: {
  tab: string;
  children: ReactNode;
}) {
  const context = useProfileContext();

  if (!context.visibleTabs.includes(tab as never)) {
    return null;
  }

  return <>{children}</>;
}

