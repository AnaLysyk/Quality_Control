import useSWR from "swr";

const EMPTY_MESSAGES: unknown[] = [];

export function useSWRChat() {
  const fetcher = (url: string) => fetch(url).then((res) => res.json());
  const { data: messages, error, mutate, isLoading } = useSWR("/api/chat/messages", fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });
  return { messages: messages || EMPTY_MESSAGES, error, mutate, isLoading };
}
