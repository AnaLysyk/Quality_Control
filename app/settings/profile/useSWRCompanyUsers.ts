import useSWR from "swr";
import { profileSwrOptions, swrProfileFetcher } from "./swrFetch";

export function useSWRCompanyUsers(shouldFetch: boolean, companyScopeKey: string | null) {
  const key = shouldFetch && companyScopeKey ? ["/api/me/company-users", companyScopeKey] as const : null;
  const { data, error, isLoading, mutate } = useSWR(key, swrProfileFetcher, profileSwrOptions);
  return {
    companyUsers: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}
