import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  const payload = {
    status: "ok",
    service: "quality-control-api",
    time: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    env: process.env.NODE_ENV ?? "unknown",
    version: process.env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  };

  const res = NextResponse.json(payload, { status: 200 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
