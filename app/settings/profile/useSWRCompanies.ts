import useSWR from "swr";
import { profileSwrOptions, swrProfileFetcher } from "./swrFetch";

export function useSWRCompanies(hasCompanyContext: boolean) {
  const shouldFetch = hasCompanyContext;
  const { data, error, isLoading, mutate } = useSWR(
    shouldFetch ? "/api/me/clients" : null,
    swrProfileFetcher,
    profileSwrOptions,
  );
  return {
    companies: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}
