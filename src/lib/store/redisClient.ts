const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

function authHeaders(): Record<string, string> {
  return UPSTASH_TOKEN ? { Authorization: `Bearer ${UPSTASH_TOKEN}` } : {};
}

export async function getJson(key: string) {
  if (!UPSTASH_URL) return null;
  const url = `${UPSTASH_URL}/get/${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: authHeaders() as HeadersInit });
  if (!res.ok) return null;
  const body = await res.json();
  try {
    // Upstash returns { result: "<stringified>" } for get
    const v = body?.result ?? null;
    if (v == null) return null;
    return JSON.parse(v);
  } catch (e) {
    return body?.result ?? null;
  }
}

export async function setJson(key: string, value: any) {
  if (!UPSTASH_URL) throw new Error('UPSTASH_REDIS_REST_URL not set');
  const url = `${UPSTASH_URL}/set/${encodeURIComponent(key)}`;
  const body = typeof value === 'string' ? value : JSON.stringify(value);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', ...(authHeaders() as Record<string, string>) } as HeadersInit,
    body,
  });
  if (!res.ok) throw new Error(`Upstash set failed: ${res.status}`);
  return true;
}

export async function deleteKey(key: string) {
  if (!UPSTASH_URL) throw new Error('UPSTASH_REDIS_REST_URL not set');
  const url = `${UPSTASH_URL}/del/${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: 'POST', headers: authHeaders() as HeadersInit });
  if (!res.ok) throw new Error('delete failed');
  return true;
}
