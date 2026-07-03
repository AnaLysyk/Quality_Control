import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

function appendSearchParams(base: URLSearchParams, input?: Record<string, string | string[] | undefined>) {
  if (!input) return;
  for (const [key, value] of Object.entries(input)) {
    if (key === "scope") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim()) base.append(key, item);
      }
      continue;
    }

    if (typeof value === "string" && value.trim()) base.set(key, value);
  }
}

export default async function AgendaScopedPage({ searchParams }: PageProps) {
  const resolved = searchParams instanceof Promise ? await searchParams : searchParams;
  const params = new URLSearchParams();
  params.set("scope", "general");
  appendSearchParams(params, resolved);

  redirect(`/agenda?${params.toString()}`);
}
