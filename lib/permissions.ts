/**
 * Resolve as capabilities efetivas de um usuário a partir de seu papel global, papel na empresa e capabilities específicas de vínculo.
 * @param params.globalRole Papel global (ex: "global_admin" ou null)
 * @param params.companyRole Papel na empresa (ex: "company_admin", "it_dev", "viewer", "user")
 * @param params.membershipCapabilities Lista de capabilities específicas do vínculo (opcional)
 * @returns Lista de capabilities efetivas (string[])
 */
export function resolveCapabilities(params: {
	globalRole: string | null;
	companyRole: string;
	membershipCapabilities?: string[] | null;
}): string[] {
	const { globalRole, companyRole, membershipCapabilities } = params;
	// Capabilities padrão por papel
	const base: string[] = [];
	if (globalRole === "global_admin") {
		base.push(
			"company:read",
			"company:write",
			"user:read",
			"user:write",
			"release:read",
			"release:write",
			"admin:all"
		);
	}
	if (companyRole === "company_admin" || companyRole === "company") {
		base.push("release:read", "release:write", "user:read", "user:write");
	} else if (companyRole === "it_dev") {
		base.push("release:read", "release:write");
	} else if (companyRole === "viewer") {
		base.push("release:read");
	} else {
		base.push("release:read");
	}
	// Adiciona capabilities específicas do vínculo, se houver
	if (Array.isArray(membershipCapabilities)) {
		for (const cap of membershipCapabilities) {
			if (!base.includes(cap)) base.push(cap);
		}
	}
	return base;
}
/**
 * Verifica se o usuário possui determinada capability.
 * @param capabilities Lista de capabilities do usuário
 * @param required Capability obrigatória (string)
 * @returns true se o usuário possui a capability
 */
export function hasCapability(capabilities: string[], required: string): boolean {
	if (!Array.isArray(capabilities)) return false;
	return capabilities.includes(required);
}

// Utilitários de senha e segurança para autenticação
// (Este bloco pode ser movido para um arquivo dedicado, ex: passwordUtils.ts)
try {
	// "server-only" existe no runtime Next.js; ignorar em scripts.
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

/**
 * Gera hash SHA-256 de uma senha (legado).
 */
export function hashPasswordSha256(password: string): string {
	return createHash("sha256").update(password).digest("hex");
}

/**
 * Compara duas strings hexadecimais de forma segura (timing-safe).
 */
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

/**
 * Gera hash seguro (argon2id) para senha.
 */
export async function hashPassword(password: string): Promise<string> {
	return argon2.hash(password, ARGON_DEFAULTS);
}

/**
 * Verifica senha contra hash salvo (argon2id ou SHA-256 legado).
 */
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

/**
 * Gera senha temporária segura, sem caracteres ambíguos.
 */
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
