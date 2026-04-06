import useSWR from "swr";

type ReleaseItem = {
  slug: string;
  title: string;
  summary: string;
  app?: string;
  project?: string;
  createdAt?: string;
  source?: string;
};

type ReleasesResponse = {
  releases?: ReleaseItem[];
};

const EMPTY_RELEASES: ReleaseItem[] = [];

export function useSWRReleases() {
  const fetcher = async (url: string): Promise<ReleasesResponse> => {
    const response = await fetch(url, { cache: "no-store" });
    return response.json();
  };

  const { data, error, isLoading, mutate } = useSWR("/api/releases", fetcher);

  return {
    releases: data?.releases ?? EMPTY_RELEASES,
    loading: isLoading,
    error,
    refetch: mutate,
  };
}
