import useSWR from "swr";

export function useSWRCompanyData(companyId: string) {
  const fetcher = (url: string) => fetch(url).then((res) => res.json());
  const shouldFetch = !!companyId;
  const { data, error, isLoading, mutate } = useSWR(
    shouldFetch ? `/api/clients/${companyId}` : null,
    fetcher
  );
  return {
    companyData: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}
