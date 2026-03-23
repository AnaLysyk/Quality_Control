import useSWR from "swr";

export function useSWRChat() {
  const fetcher = (url: string) => fetch(url).then((res) => res.json());
  const { data: messages, error, mutate, isLoading } = useSWR("/api/chat/messages", fetcher, {
    refreshInterval: 2000, // Atualiza a cada 2s
  });
  return { messages: messages || [], error, mutate, isLoading };
}
