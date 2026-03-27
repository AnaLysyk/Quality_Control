import useSWR from "swr";
import { profileSwrOptions, swrProfileFetcher } from "./swrFetch";

export function useSWRProfileSummary(userId?: string) {
  const shouldFetch = !!userId;
  const { data, error, isLoading, mutate } = useSWR(
    shouldFetch ? "/api/me/profile-summary" : null,
    swrProfileFetcher,
    profileSwrOptions,
  );
  return {
    profileSummary: data,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}
