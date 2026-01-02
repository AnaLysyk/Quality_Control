import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/jwtAuth";

export async function POST() {
  clearAuthCookie();
  return NextResponse.json({ ok: true });
}
