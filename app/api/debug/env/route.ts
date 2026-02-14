// app/api/debug/env/route.ts
import { NextResponse } from "next/server";

const SENSITIVE_PREFIXES = ["postgres", "database", "connection", "url"];

function isDevelopment() {
  return (process.env.NODE_ENV ?? "production") === "development";
}

export async function GET() {
  if (!isDevelopment()) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const keys = Object.keys(process.env || {})
    .filter((key) => {
      const lowered = key.toLowerCase();
      return SENSITIVE_PREFIXES.some((prefix) => lowered.includes(prefix));
    })
    .sort();

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV ?? null,
    variables: keys.map((key) => ({ key, isSet: process.env[key] != null })),
  });
}
