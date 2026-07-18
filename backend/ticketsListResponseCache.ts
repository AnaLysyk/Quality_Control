const TICKETS_LIST_CACHE_TTL_MS = 10_000;

type TicketsListCacheEntry = {
  expiresAt: number;
  payload: unknown;
};

type TicketsListCacheState = typeof globalThis & {
  __qcTicketsListCache?: Map<string, TicketsListCacheEntry>;
};

function getTicketsListCache() {
  const state = globalThis as TicketsListCacheState;
  if (!state.__qcTicketsListCache) {
    state.__qcTicketsListCache = new Map();
  }
  return state.__qcTicketsListCache;
}

export function buildTicketsListCacheKey(input: {
  userId: string;
  url: URL;
  globalScope: boolean;
}) {
  const params = new URLSearchParams(input.url.searchParams);
  params.delete("force");
  params.sort();
  return `${input.globalScope ? "all" : input.userId}:${params.toString()}`;
}

export function readTicketsListCache<T>(key: string): T | null {
  const cached = getTicketsListCache().get(key);
  if (!cached || cached.expiresAt <= Date.now()) return null;
  return cached.payload as T;
}

export function writeTicketsListCache(key: string, payload: unknown) {
  getTicketsListCache().set(key, {
    payload,
    expiresAt: Date.now() + TICKETS_LIST_CACHE_TTL_MS,
  });
}

export function clearTicketsListCache() {
  getTicketsListCache().clear();
}
