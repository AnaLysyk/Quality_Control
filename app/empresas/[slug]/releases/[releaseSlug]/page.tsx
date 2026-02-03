import { ReleasePageContent } from "@/release/ReleaseTemplate";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string; releaseSlug: string }>;
};

export default async function CompanyReleaseDetailPage({ params }: PageProps) {
  const { slug, releaseSlug } = await params;
  return <ReleasePageContent slug={releaseSlug} companySlug={slug} />;
}
