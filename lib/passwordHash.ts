try {
  // "server-only" exists in Next.js runtime; ignore when running scripts.
  require("server-only");
} catch {
  // no-op
}

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import argon2 from "argon2";

const ARGON_DEFAULTS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,
  timeCost: 3,
  parallelism: 1,
};

const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const TEMP_PASSWORD_LENGTH = 14;

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

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON_DEFAULTS);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;
  if (storedHash.startsWith("$argon2")) {
    try {
      return await argon2.verify(storedHash, password, ARGON_DEFAULTS);
    } catch {
      return false;
    }
  }
  const legacy = hashPasswordSha256(password);
  return safeEqualHex(legacy, storedHash);
}

export function generateTempPassword(length = TEMP_PASSWORD_LENGTH): string {
  if (length <= 0) {
    throw new Error("Temp password length must be positive");
  }
  const alphabet = TEMP_PASSWORD_ALPHABET;
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i += 1) {
    const index = bytes[i] % alphabet.length;
    result += alphabet[index];
  }
  return result;
}
