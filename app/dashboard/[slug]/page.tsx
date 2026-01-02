import DashboardReleaseClient from "../DashboardReleaseClient";

interface PageProps {
  params: { slug: string };
}

async function fetchRelease(slug: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/releases/${slug}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    console.error("Erro ao buscar release", e);
    return null;
  }
}

export default async function DashboardReleasePage({ params }: PageProps) {
  const initialData = await fetchRelease(params.slug);
  return <DashboardReleaseClient slug={params.slug} initialData={initialData} />;
}

