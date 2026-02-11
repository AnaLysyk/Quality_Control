import "server-only";

import crypto from "node:crypto";

function hashSeed(seed: string) {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

export function getJwtSecret(): string | null {
  const envSecret = process.env.JWT_SECRET;
  if (typeof envSecret === "string" && envSecret.trim()) {
    return envSecret.trim();
  }

  const fallbackSeed =
    process.env.JWT_FALLBACK_SECRET ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL ||
    "";

  if (fallbackSeed.trim()) {
    return hashSeed(`qc:${fallbackSeed.trim()}`);
  }

  if (process.env.NODE_ENV !== "production") {
    return "dev-insecure-secret";
  }

  return null;
}
