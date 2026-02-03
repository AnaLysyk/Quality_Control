import { ReleasePageContent } from "@/release/ReleaseTemplate";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string; runSlug: string }>;
};

export default async function CompanyRunDetailPage({ params }: PageProps) {
  const { slug, runSlug } = await params;
  return <ReleasePageContent slug={runSlug} companySlug={slug} />;
}
