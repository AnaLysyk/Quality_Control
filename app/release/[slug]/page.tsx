import { ReleasePageContent } from "@/release/ReleaseTemplate";

type PageParams = {
  params: { slug: string };
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ReleasePage({ params }: PageParams) {
  const slug = params.slug;
  return ReleasePageContent({ slug });
}
