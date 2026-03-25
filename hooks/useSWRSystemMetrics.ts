import useSWR from "swr";

export function useSWRSystemMetrics() {
  const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((res) => res.json());
  const { data, error, isLoading, mutate } = useSWR("/api/metrics/overview", fetcher, {
    refreshInterval: 5 * 60 * 1000, // 5 minutos
    revalidateOnFocus: true,
  });
  return {
    metrics: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}
