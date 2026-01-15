import "server-only";

import { createHash, timingSafeEqual } from "crypto";

export function hashPasswordSha256(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}
