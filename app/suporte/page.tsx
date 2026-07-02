import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function buildQueryString(params?: Record<string, string | string[] | undefined>) {
  if (!params) return "";

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined) query.append(key, item);
      });
      continue;
    }

    if (value !== undefined) query.set(key, value);
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export default async function SuportePage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  redirect(`/admin/chamados${buildQueryString(resolvedSearchParams)}`);
}

