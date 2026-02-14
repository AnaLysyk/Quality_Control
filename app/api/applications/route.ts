import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type AppInfo = {
  slug: string;
  name: string;
  tag: string;
};

const fallbackApps: readonly AppInfo[] = [
  { slug: "smart", name: "SMART", tag: "SMART" },
  { slug: "print", name: "PRINT", tag: "PRINT" },
  { slug: "booking", name: "BOOKING", tag: "BOOKING" },
  { slug: "trust", name: "TRUST", tag: "TRUST" },
  { slug: "cidadao-smart", name: "CIDADAO SMART", tag: "CIDADAO" },
  { slug: "mobile-griaule", name: "GRIAULE MOBILE", tag: "MOBILE" },
] as const;

function isAppInfo(value: unknown): value is AppInfo {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppInfo>;
  return (
    typeof candidate.slug === "string" &&
    candidate.slug.length > 0 &&
    typeof candidate.name === "string" &&
    candidate.name.length > 0 &&
    typeof candidate.tag === "string" &&
    candidate.tag.length > 0
  );
}

function loadApplications(): AppInfo[] {
  const raw = process.env.APPS_JSON;
  if (!raw || raw.trim().length === 0) {
    return [...fallbackApps];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...fallbackApps];
    }
    const items = parsed.filter(isAppInfo);
    return items.length > 0 ? items : [...fallbackApps];
  } catch (error) {
    console.error("APPS_JSON parse error", error);
    return [...fallbackApps];
  }
}

export async function GET() {
  const applications = loadApplications().sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(
    { applications },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
