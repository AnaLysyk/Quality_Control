export const dynamic = "force-dynamic";

import { ReleasePageContent } from "@/release/ReleaseTemplate";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return ReleasePageContent({ slug });
}
