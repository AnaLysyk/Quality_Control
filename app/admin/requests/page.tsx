import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toQueryString(params?: Record<string, string | string[] | undefined>) {
  if (!params) return "";
  const query = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(params)) {
    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        if (typeof value === "string" && value.length > 0) query.append(key, value);
      }
      continue;
    }

    if (typeof rawValue === "string" && rawValue.length > 0) {
      query.set(key, rawValue);
    }
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export default async function LegacyAdminRequestsPage({ searchParams }: PageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  redirect(`/admin/access-requests${toQueryString(resolved)}`);
}
