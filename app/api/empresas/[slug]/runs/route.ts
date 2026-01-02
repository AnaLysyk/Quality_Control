import { NextResponse } from "next/server";

export async function GET() {
  // Placeholder: reusa /api/releases como fonte global de runs
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/releases`, {
    cache: "no-store",
  }).catch(() => null);

  if (!res || !res.ok) {
    return NextResponse.json({ runs: [] }, { status: 200 });
  }

  const data = await res.json().catch(() => ({ releases: [] }));
  return NextResponse.json({ runs: data.releases ?? [] }, { status: 200 });
}
