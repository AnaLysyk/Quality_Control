import useSWRMutation from "swr/mutation";

export function useSWRQaseProjects() {
  const fetcher = async (url: string, { arg }: { arg: { token: string } }) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(arg),
    });
    if (!res.ok) throw new Error("Erro ao buscar projetos");
    return res.json();
  };
  const { trigger, data, error, isMutating } = useSWRMutation("/api/admin/qase/projects", fetcher, {
    populateCache: true,
    revalidate: false,
  });
  return {
    fetchProjects: trigger,
    projects: data?.items || [],
    error,
    loading: isMutating,
  };
}
