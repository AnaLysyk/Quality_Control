import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type AppInfo = {
  slug: string;
  name: string;
  tag: string;
};

const fallbackApps: AppInfo[] = [
  { slug: "smart", name: "SMART", tag: "SMART" },
  { slug: "print", name: "PRINT", tag: "PRINT" },
  { slug: "booking", name: "BOOKING", tag: "BOOKING" },
  { slug: "trust", name: "TRUST", tag: "TRUST" },
  { slug: "cidadao-smart", name: "CIDADAO SMART", tag: "CIDADAO" },
  { slug: "mobile-griaule", name: "GRIAULE MOBILE", tag: "MOBILE" },
];

export async function GET() {
  return NextResponse.json({ applications: fallbackApps }, { status: 200 });
}
