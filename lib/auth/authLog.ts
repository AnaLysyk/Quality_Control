import crypto from "crypto";

/**
 * Minimal structured logging for authentication events.
 * Hashes sensitive fields (ip, user-agent) for privacy.
 * Never log secrets, tokens, or raw PII.
 */
function h(v: string | null | undefined): string | null {
  if (!v) return null;
  return crypto.createHash("sha256").update(v).digest("hex").slice(0, 16);
}

export function authLog(
  event: string,
  data: Record<string, unknown> & {
    ip_hash?: string | null;
    user_agent_hash?: string | null;
  }
) {
  // Defensive: hash ip/user-agent if not already hashed
  const safe: Record<string, unknown> = { ...data };
  if ("ip_hash" in safe && typeof safe.ip_hash === "string" && safe.ip_hash.length < 16) {
    safe.ip_hash = h(safe.ip_hash);
  }
  if ("user_agent_hash" in safe && typeof safe.user_agent_hash === "string" && safe.user_agent_hash.length < 16) {
    safe.user_agent_hash = h(safe.user_agent_hash);
  }
  // In production, replace with a real logger
  console.log(
    JSON.stringify({
      event,
      ts: new Date().toISOString(),
      ...safe,
    })
  );
}
