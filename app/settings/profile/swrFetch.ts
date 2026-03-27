export const profileSwrOptions = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
  keepPreviousData: true,
  dedupingInterval: 30_000,
  focusThrottleInterval: 60_000,
  shouldRetryOnError: false,
} as const;

export async function swrProfileFetcher(input: string | readonly [string, string]) {
  const url = Array.isArray(input) ? input[0] : input;
  const response = await fetch(url, { credentials: "include", cache: "no-store" });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `Erro HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}
