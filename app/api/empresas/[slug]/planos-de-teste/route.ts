import { NextResponse } from "next/server";

export async function GET() {
  // Placeholder: use global mock and assume filter by slug in future.
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/test-plans`, {
    cache: "no-store",
  }).catch(() => null);

  if (!res || !res.ok) {
    return NextResponse.json({ plans: [], totalTests: 0 }, { status: 200 });
  }

  const data = await res.json().catch(() => ({ plans: [], totalTests: 0 }));
  return NextResponse.json(data, { status: 200 });
}
