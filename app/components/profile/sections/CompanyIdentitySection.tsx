"use client";

/**
 * Company Identity Section — Dados básicos da empresa
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
    <div className="rounded-lg border border-tc-border p-6 bg-tc-surface">
      <h3 className="text-lg font-semibold text-tc-text-primary mb-6">
        Dados da Empresa
      </h3>

      <CompanyProfileForm companyId={companyId} initialData={data} />
    </div>
  );
}
