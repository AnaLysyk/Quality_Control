"use client";

/**
 * User Identity Section — Dados básicos do usuário
 */

import { useProfileContext } from "@/lib/profile/useProfileContext";
import { UserProfileForm } from "../forms/UserProfileForm";

export type UserIdentitySectionProps = {
  userId: string;
  data: {
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
  };
};

export function UserIdentitySection({
  userId,
  data,
}: UserIdentitySectionProps) {
  const { visibleTabs } = useProfileContext();

  if (!visibleTabs.includes("profile")) {
    return null;
  }

  return (
    <div className="rounded-lg border border-(--tc-border) bg-(--tc-surface) p-6">
      <h3 className="mb-6 text-lg font-semibold text-(--tc-text-primary)">
        Dados Pessoais
      </h3>

      <UserProfileForm userId={userId} initialData={data} />
    </div>
  );
}
