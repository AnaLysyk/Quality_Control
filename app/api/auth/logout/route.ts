import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/jwtAuth";

const EXTRA_COOKIES = [
  "access_token",
  "refresh_token",
  "sb-access-token",
  "sb-refresh-token",
];

export const runtime = "nodejs";

export async function POST() {
  await clearAuthCookie();
  const response = NextResponse.json({ ok: true });

  for (const name of EXTRA_COOKIES) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}
