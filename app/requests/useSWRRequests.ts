import useSWR from "swr";

export function useSWRRequests() {
  const fetcher = (url: string) => fetch(url, { credentials: "include", cache: "no-store" }).then((res) => res.json());
  const { data, error, isLoading, mutate } = useSWR("/api/requests/me", fetcher);
  return {
    requests: data?.items || [],
    loading: isLoading,
    error,
    refetch: mutate,
  };
}
