import useSWR from "swr";

export function useSWRProfileSummary(userId?: string) {
  const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((res) => res.json());
  const shouldFetch = !!userId;
  const { data, error, isLoading, mutate } = useSWR(
    shouldFetch ? "/api/me/profile-summary" : null,
    fetcher
  );
  return {
    profileSummary: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}
