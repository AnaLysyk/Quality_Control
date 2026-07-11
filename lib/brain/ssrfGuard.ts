import { isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";

export type SsrfGuardResult = { ok: true; url: URL } | { ok: false; reason: string };

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

// Bloqueia loopback, redes privadas (RFC1918), link-local (inclui metadata de nuvem
// 169.254.169.254), unique-local IPv6, multicast e reservada carrier-grade NAT.
function isPrivateOrReservedIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local / metadata de nuvem
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 0) return true; // "esta rede"
    if (a >= 224) return true; // multicast/reservado
    return false;
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::1") return true; // loopback
    if (normalized === "::") return true;
    if (normalized.startsWith("fe80:")) return true; // link-local
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique-local
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice("::ffff:".length);
      return isIP(mapped) === 4 ? isPrivateOrReservedIp(mapped) : false;
    }
    return false;
  }
  return false;
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

/**
 * Valida uma URL fornecida por configuracao de usuario (fonte externa do Brain) antes de
 * qualquer fetch real, bloqueando acesso a rede privada/loopback/metadata de nuvem (SSRF).
 * Resolve o hostname via DNS para pegar tambem dominios que apontam para IP privado.
 */
export async function guardOutboundUrl(rawUrl: string): Promise<SsrfGuardResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "URL invalida." };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, reason: "Protocolo nao permitido. Use http ou https." };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { ok: false, reason: "Host bloqueado por seguranca." };
  }

  if (isIP(hostname) && isPrivateOrReservedIp(hostname)) {
    return { ok: false, reason: "Endereco de rede privada ou reservada bloqueado." };
  }

  if (!isIP(hostname)) {
    try {
      const resolved = await dnsLookup(hostname, { all: true });
      if (resolved.some((entry) => isPrivateOrReservedIp(entry.address))) {
        return { ok: false, reason: "Dominio resolve para rede privada ou reservada." };
      }
    } catch {
      return { ok: false, reason: "Nao foi possivel resolver o host informado." };
    }
  }

  return { ok: true, url: parsed };
}

/**
 * fetch protegido contra SSRF: valida a URL (e o host resolvido) antes de conectar e
 * nunca segue redirect automaticamente, para nao ser desviado para rede interna.
 */
export async function safeOutboundFetch(rawUrl: string, init: RequestInit = {}) {
  const guard = await guardOutboundUrl(rawUrl);
  if (!guard.ok) {
    throw new Error(`Bloqueado por protecao SSRF: ${guard.reason}`);
  }
  return fetch(guard.url.toString(), { ...init, redirect: "manual" });
}
