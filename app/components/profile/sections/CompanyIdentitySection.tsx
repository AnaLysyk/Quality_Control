"use client";

/**
 * Company Identity Section â€” Dados bÃ¡sicos da empresa
 */

import { useProfileContext } from "@/lib/profile/useProfileContext";
import { CompanyProfileForm } from "../forms/CompanyProfileForm";

export type CompanyIdentitySectionProps = {
  companyId: string;
  data: {
    name: string;
    slug: string;
    taxId?: string;
    phone?: string;
    website?: string;
  };
};

export function CompanyIdentitySection({
  companyId,
  data,
}: CompanyIdentitySectionProps) {
  const { visibleTabs } = useProfileContext();

  if (!visibleTabs.includes("profile")) {
    return null;
  }

  return (
    <div className="rounded-lg border border-(--tc-border) bg-(--tc-surface) p-6">
      <h3 className="mb-6 text-lg font-semibold text-(--tc-text-primary)">
        Dados da Empresa
      </h3>

      <CompanyProfileForm companyId={companyId} initialData={data} />
    </div>
  );
}

