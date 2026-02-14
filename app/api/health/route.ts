import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    env: process.env.NODE_ENV,
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
}
