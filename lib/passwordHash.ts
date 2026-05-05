try {
  // "server-only" exists in Next.js runtime; ignore when running scripts.
  require("server-only");
} catch {
  // no-op
}

import { createHash, randomBytes, timingSafeEqual } from "crypto";

// Charset without visually ambiguous characters (0/O, 1/l/I)
const TEMP_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const TEMP_PASSWORD_LENGTH = 12;

export function generateTempPassword(): string {
  const bytes = randomBytes(TEMP_PASSWORD_LENGTH);
  return Array.from(bytes)
    .map((b) => TEMP_PASSWORD_CHARS[b % TEMP_PASSWORD_CHARS.length])
    .join("");
}

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
