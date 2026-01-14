import { ReleasePageContent } from "@/release/ReleaseTemplate";

type PageProps = {
  params: { slug: string };
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DashboardReleasePage({ params }: PageProps) {
  return ReleasePageContent({ slug: params.slug, companySlug: params.slug });
}
