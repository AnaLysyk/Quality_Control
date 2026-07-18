try {
  // "server-only" exists in Next.js runtime; ignore when running scripts.
  require("server-only");
} catch {
  // no-op
}

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

// Charset without visually ambiguous characters (0/O, 1/l/I)
const TEMP_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // NOSONAR: charset for generation, not a credential
const TEMP_PASSWORD_LENGTH = 12;
const SCRYPT_VERSION = "v1";
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_SALT_LENGTH = 16;

export function generateTempPassword(): string {
  const bytes = randomBytes(TEMP_PASSWORD_LENGTH);
  return Array.from(bytes)
    .map((b) => TEMP_PASSWORD_CHARS[b % TEMP_PASSWORD_CHARS.length])
    .join("");
}

export function hashPasswordSha256(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

/**
 * Gera um hash lento e salgado para novas credenciais.
 * `hashPasswordSha256` permanece exportado somente para validar/migrar registros
 * legados e para fixtures antigas; não deve ser usado para novas senhas.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SCRYPT_SALT_LENGTH);
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: 64 * 1024 * 1024,
  });

  return [
    "scrypt",
    SCRYPT_VERSION,
    String(SCRYPT_COST),
    String(SCRYPT_BLOCK_SIZE),
    String(SCRYPT_PARALLELIZATION),
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

function verifyScryptPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split("$");
  if (parts.length !== 7) return false;

  const [algorithm, version, cost, blockSize, parallelization, saltValue, hashValue] = parts;
  if (
    algorithm !== "scrypt" ||
    version !== SCRYPT_VERSION ||
    Number(cost) !== SCRYPT_COST ||
    Number(blockSize) !== SCRYPT_BLOCK_SIZE ||
    Number(parallelization) !== SCRYPT_PARALLELIZATION
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(hashValue, "base64url");
    if (salt.length !== SCRYPT_SALT_LENGTH || expected.length !== SCRYPT_KEY_LENGTH) return false;

    const actual = scryptSync(password, salt, expected.length, {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELIZATION,
      maxmem: 64 * 1024 * 1024,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (storedHash.startsWith("scrypt$")) {
    return verifyScryptPassword(password, storedHash);
  }

  // Compatibilidade temporária: hashes SHA-256 existentes são atualizados no
  // próximo login bem-sucedido.
  if (!/^[a-f0-9]{64}$/i.test(storedHash)) return false;
  return safeEqualHex(hashPasswordSha256(password), storedHash);
}

export function passwordHashNeedsUpgrade(storedHash: string): boolean {
  return !storedHash.startsWith(`scrypt$${SCRYPT_VERSION}$`);
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
