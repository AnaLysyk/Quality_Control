import useSWR from "swr";

type RequestItem = {
  id: string;
  type: "EMAIL_CHANGE" | "COMPANY_CHANGE" | "PASSWORD_RESET" | "PROFILE_DELETION";
  status: "PENDING" | "APPROVED" | "REJECTED";
  payload: Record<string, unknown>;
  createdAt: string;
  reviewNote?: string;
};

type RequestsResponse = {
  items?: RequestItem[];
  canReview?: boolean;
  scope?: "all" | "own";
};

const EMPTY_REQUESTS: RequestItem[] = [];

export function useSWRRequests() {
  const fetcher = async (url: string): Promise<RequestsResponse> => {
    const response = await fetch(url, { credentials: "include", cache: "no-store" });
    return response.json();
  };

  const { data, error, isLoading, mutate } = useSWR("/api/requests/me", fetcher);

  return {
    requests: data?.items ?? EMPTY_REQUESTS,
    canReview: data?.canReview === true,
    scope: data?.scope === "all" ? "all" : "own",
    loading: isLoading,
    error,
    refetch: mutate,
  };
}
