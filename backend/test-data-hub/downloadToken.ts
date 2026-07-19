import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getJwtSecret } from "@/backend/auth/jwtSecret";

export const TEST_DATA_DOWNLOAD_PURPOSES = ["playwright", "test_execution", "documentation"] as const;
export type TestDataDownloadPurpose = (typeof TEST_DATA_DOWNLOAD_PURPOSES)[number];

const MAX_TOKEN_LIFETIME_MS = 15 * 60 * 1000;

type DownloadTokenPayload = {
  assetId: string;
  userId: string;
  purpose: TestDataDownloadPurpose;
  expiresAt: number;
};

function isPurpose(value: unknown): value is TestDataDownloadPurpose {
  return typeof value === "string" && TEST_DATA_DOWNLOAD_PURPOSES.includes(value as TestDataDownloadPurpose);
}

function sign(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createTestDataDownloadToken(
  input: Omit<DownloadTokenPayload, "expiresAt"> & { expiresAt?: number },
) {
  const secret = getJwtSecret();
  if (!secret) throw new Error("JWT_SECRET is required to sign test-data downloads");

  const now = Date.now();
  const payload: DownloadTokenPayload = {
    assetId: input.assetId,
    userId: input.userId,
    purpose: input.purpose,
    expiresAt: Math.min(input.expiresAt ?? now + MAX_TOKEN_LIFETIME_MS, now + MAX_TOKEN_LIFETIME_MS),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyTestDataDownloadToken(
  token: string | null,
  expected: { assetId: string; userId: string; purpose: TestDataDownloadPurpose },
): { valid: true; expiresAt: number } | { valid: false; reason: string } {
  if (!token) return { valid: false, reason: "Download token is required" };

  const secret = getJwtSecret();
  if (!secret) return { valid: false, reason: "Download token validation is unavailable" };

  const [encodedPayload, providedSignature, extra] = token.split(".");
  if (!encodedPayload || !providedSignature || extra) return { valid: false, reason: "Invalid download token" };

  const expectedSignature = sign(encodedPayload, secret);
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return { valid: false, reason: "Invalid download token" };
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<DownloadTokenPayload>;
    if (
      payload.assetId !== expected.assetId ||
      payload.userId !== expected.userId ||
      payload.purpose !== expected.purpose ||
      !isPurpose(payload.purpose) ||
      typeof payload.expiresAt !== "number" ||
      !Number.isFinite(payload.expiresAt)
    ) {
      return { valid: false, reason: "Download token does not match this request" };
    }
    if (payload.expiresAt <= Date.now()) return { valid: false, reason: "Download token expired" };
    if (payload.expiresAt > Date.now() + MAX_TOKEN_LIFETIME_MS) {
      return { valid: false, reason: "Download token lifetime is invalid" };
    }
    return { valid: true, expiresAt: payload.expiresAt };
  } catch {
    return { valid: false, reason: "Invalid download token" };
  }
}
