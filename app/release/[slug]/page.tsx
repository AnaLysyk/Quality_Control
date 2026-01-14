import { ReleasePageContent } from "@/release/ReleaseTemplate";

type PageParams = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ReleasePage({ params }: PageParams) {
  const { slug } = await params;
  return ReleasePageContent({ slug });
}
