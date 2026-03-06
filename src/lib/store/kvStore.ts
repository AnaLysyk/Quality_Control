// Upstash adapter: prefer the official SDK when available (server env),
// otherwise fall back to REST endpoints. All values are stored as JSON strings.

import { Redis } from '@upstash/redis';

const REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

let sdk: ReturnType<typeof Redis.fromEnv> | null = null;
try {
  // Redis.fromEnv() will throw if necessary env vars are missing; guard it.
  if (process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_TOKEN) {
    sdk = Redis.fromEnv();
  }
} catch (e) {
  sdk = null;
}

async function restGet(key: string) {
  if (!REST_URL || !REST_TOKEN) throw new Error('Upstash REST not configured');
  const endpoint = `${REST_URL}/get`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  if (!res.ok) throw new Error('Upstash GET failed');
  const j = await res.json();
  const raw = j?.result ?? null;
  if (raw === null || raw === undefined) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

async function restSet(key: string, value: any) {
  if (!REST_URL || !REST_TOKEN) throw new Error('Upstash REST not configured');
  const endpoint = `${REST_URL}/set/${encodeURIComponent(key)}`;
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN}`, 'Content-Type': 'text/plain' },
    body: serialized,
  });
  if (!res.ok) throw new Error('Upstash SET failed');
  return res.json();
}

async function get(key: string) {
  if (sdk) {
    try {
      const raw = await sdk.get(key);
      if (raw === null || raw === undefined) return null;
      // SDK may return already-parsed values; ensure JSON parse if string
      if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return raw; }
      }
      return raw;
    } catch (e) {
      // Fall back to REST
    }
  }
  return await restGet(key);
}

async function set(key: string, value: any) {
  if (sdk) {
    try {
      const toSet = typeof value === 'string' ? value : JSON.stringify(value);
      return await sdk.set(key, toSet);
    } catch (e) {
      // Fall back to REST
    }
  }
  return await restSet(key, value);
}

export default { get, set };
