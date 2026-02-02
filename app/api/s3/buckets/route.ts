import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    buckets: [{ name: "local-bucket", region: "local" }],
  });
}
