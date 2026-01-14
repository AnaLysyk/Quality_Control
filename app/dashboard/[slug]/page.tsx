import { redirect } from "next/navigation";

type PageProps = {
  params: { slug: string };
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DashboardReleasePage({ params }: PageProps) {
  void params;
  redirect("/empresas");
}
