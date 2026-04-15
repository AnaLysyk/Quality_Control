export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default async function CompanyRootRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/empresas/${encodeURIComponent(slug)}/home`);
}
