
"use client";
import useSWR from "swr";

const EMPTY_SUPPORTS: unknown[] = [];
const fetchSupports = (url: string) =>
  fetch(url, { credentials: "include", cache: "no-store" }).then((res) => res.json());

export function useSWRSupports() {
  const { data, error, isLoading, mutate } = useSWR("/api/suportes", fetchSupports);
  return {
    supports: Array.isArray(data?.items) ? data.items : EMPTY_SUPPORTS,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}
