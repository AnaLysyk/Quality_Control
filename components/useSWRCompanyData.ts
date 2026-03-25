import useSWR from "swr";

export function useSWRCompanyData(companyId: string) {
  const fetcher = (url: string) => fetch(url).then((res) => res.json());
  const shouldFetch = !!companyId;
  const { data, error, isLoading, mutate } = useSWR(
    shouldFetch ? `/api/clients/${companyId}` : null,
    fetcher,
    {
      dedupingInterval: 10000, // 10s: evita fetch duplicado
      revalidateOnFocus: false, // não refaz fetch ao focar
      revalidateOnReconnect: false, // não refaz fetch ao reconectar
      shouldRetryOnError: false, // não faz retry automático
      keepPreviousData: true, // mantém dados antigos durante novo fetch
    }
  );
  return {
    companyData: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}
