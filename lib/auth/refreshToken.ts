import "server-only";
import crypto from "node:crypto";

/**
 * Gera um refresh token seguro (UUID v4).
 */
export function createRefreshToken(): string {
  return crypto.randomUUID();
}

/**
 * Gera o hash SHA-256 de um refresh token para armazenamento seguro.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

