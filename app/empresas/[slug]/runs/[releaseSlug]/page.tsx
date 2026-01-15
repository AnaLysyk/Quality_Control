import { ReleasePageContent } from "@/release/ReleaseTemplate";
import Breadcrumb from "@/components/Breadcrumb";
import { formatCompanyDisplayName } from "@/utils/formatCompanyDisplayName";

type PageParams = {
  params: { slug: string; releaseSlug: string };
};

export default async function EmpresaRunDetailPage({ params }: PageParams) {
  const slug = params.releaseSlug || "";
  const company = params.slug || "";
  const companyName = formatCompanyDisplayName(company) || company;
  const content = await ReleasePageContent({ slug, companySlug: company });

  return (
    <div className="min-h-screen bg-(--page-bg,#ffffff) text-(--page-text,#0b1a3c)">
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-10">
        <Breadcrumb
          items={[
            { label: "Empresas", href: "/empresas" },
            {
              label: companyName,
              href: `/empresas/${encodeURIComponent(company)}/home`,
              title: companyName,
            },
            { label: "Runs", href: `/empresas/${encodeURIComponent(company)}/runs` },
            { label: <span className="block truncate">{slug}</span>, title: slug },
          ]}
        />
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 sm:pb-10 lg:px-10">
        {content}
      </div>
    </div>
  );
}
