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
    process.env.NEXTAUTH_SECRET ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    // Render injects RENDER_SERVICE_ID — constant for the lifetime of the service.
    // Using it as last-resort means JWT works out-of-the-box on Render without manual config.
    process.env.RENDER_SERVICE_ID ||
    "";

  if (fallbackSeed.trim()) {
    return hashSeed(`qc:${fallbackSeed.trim()}`);
  }

  if (process.env.NODE_ENV !== "production") {
    return "dev-insecure-secret";
  }

  return null;
}
