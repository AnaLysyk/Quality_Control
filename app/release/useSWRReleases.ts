import useSWR from "swr";

export function useSWRReleases() {
  const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((res) => res.json());
  const { data, error, isLoading, mutate } = useSWR("/api/releases", fetcher);
  return {
    releases: data?.releases || [],
    loading: isLoading,
    error,
    refetch: mutate,
  };
}
