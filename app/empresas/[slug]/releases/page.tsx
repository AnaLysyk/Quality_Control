import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CompanyReleasesPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/empresas/${encodeURIComponent(slug)}/runs`);
}
