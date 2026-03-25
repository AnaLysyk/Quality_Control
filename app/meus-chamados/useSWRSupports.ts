
"use client";
import useSWR from "swr";

export function useSWRSupports() {
  const fetcher = (url: string) => fetch(url, { credentials: "include", cache: "no-store" }).then((res) => res.json());
  const { data, error, isLoading, mutate } = useSWR("/api/suportes", fetcher);
  return {
    supports: data?.items || [],
    loading: isLoading,
    error,
    refetch: mutate,
  };
}
