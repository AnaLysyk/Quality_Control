import useSWR from "swr";

export function useSWRCompanies(hasCompanyContext: boolean) {
  const fetcher = (url: string) => fetch(url, { credentials: "include", cache: "no-store" }).then((res) => res.json());
  const shouldFetch = hasCompanyContext;
  const { data, error, isLoading, mutate } = useSWR(
    shouldFetch ? "/api/me/clients" : null,
    fetcher
  );
  return {
    companies: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}
