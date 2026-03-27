import useSWR from "swr";
import { profileSwrOptions, swrProfileFetcher } from "./swrFetch";

export function useSWRCompanyProfile(hasCompanyContext: boolean, companyScopeKey: string | null) {
  const key = hasCompanyContext && companyScopeKey ? ["/api/me/company-profile", companyScopeKey] as const : null;
  const { data, error, isLoading, mutate } = useSWR(key, swrProfileFetcher, profileSwrOptions);
  return {
    companyProfile: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}
