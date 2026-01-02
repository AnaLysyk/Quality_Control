import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/jwtAuth";

export async function POST() {
  await clearAuthCookie();
  return NextResponse.json({ ok: true });
}
