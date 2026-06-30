"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { useClientContext } from "@/lib/core/company/CompanyContext";

export type ProjectRecord = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  status: string;
  color?: string | null;
  iconKey?: string | null;
  companyId: string;
  createdAt?: string | null;
};

type ProjectContextValue = {
  projects: ProjectRecord[];
  activeProjectId: string | null;
  activeProjectSlug: string | null;
  activeProject: ProjectRecord | null;
  loading: boolean;
  error: string | null;
  setActiveProject: (slugOrId: string | null) => void;
  refreshProjects: () => Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

const storageKey = (companyId: string) => `activeProject:${companyId}`;
const getSessionStorage = () => (typeof window === "undefined" ? null : window.sessionStorage);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { activeClient, activeClientSlug } = useClientContext();

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectSlug, setActiveProjectSlugState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async (companySlug: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects?companySlug=${encodeURIComponent(companySlug)}`);
      if (!res.ok) throw new Error("Falha ao carregar projetos");
      const json = (await res.json()) as { projects?: ProjectRecord[] };
      const list = json.projects ?? [];
      setProjects(list);
      return list;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar projetos";
      setError(msg);
      setProjects([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload projects when active company changes
  useEffect(() => {
    if (!activeClientSlug) {
      setProjects([]);
      setActiveProjectSlugState(null);
      return;
    }

    fetchProjects(activeClientSlug).then((list) => {
      if (list.length === 0) {
        setActiveProjectSlugState(null);
        return;
      }

      const storage = getSessionStorage();
      const companyId = activeClient?.id ?? activeClientSlug;
      const stored = storage?.getItem(storageKey(companyId)) ?? null;
      const storedProject = stored
        ? list.find((p) => p.slug === stored || p.id === stored) ?? null
        : null;

      const resolved = storedProject?.slug ?? list[0].slug;
      setActiveProjectSlugState(resolved);
      storage?.setItem(storageKey(companyId), resolved);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClientSlug]);

  const setActiveProject = useCallback(
    (slugOrId: string | null) => {
      if (!slugOrId) {
        setActiveProjectSlugState(null);
        if (activeClient?.id) getSessionStorage()?.removeItem(storageKey(activeClient.id));
        return;
      }
      const found = projects.find((p) => p.slug === slugOrId || p.id === slugOrId);
      if (!found) return;
      setActiveProjectSlugState(found.slug);
      if (activeClient?.id) {
        getSessionStorage()?.setItem(storageKey(activeClient.id), found.slug);
      }
    },
    [projects, activeClient]
  );

  const refreshProjects = useCallback(async () => {
    if (!activeClientSlug) return;
    await fetchProjects(activeClientSlug);
  }, [activeClientSlug, fetchProjects]);

  const activeProject = useMemo(
    () => (activeProjectSlug ? projects.find((p) => p.slug === activeProjectSlug) ?? null : null),
    [projects, activeProjectSlug]
  );

  useEffect(() => {
    const root = document.documentElement;

    if (activeProjectSlug) {
      root.dataset.project = activeProjectSlug;
    } else {
      delete root.dataset.project;
    }

    if (activeProject?.id) {
      root.dataset.projectId = activeProject.id;
    } else {
      delete root.dataset.projectId;
    }
  }, [activeProjectSlug, activeProject?.id]);

  const value = useMemo<ProjectContextValue>(
    () => ({
      projects,
      activeProjectId: activeProject?.id ?? null,
      activeProjectSlug,
      activeProject,
      loading,
      error,
      setActiveProject,
      refreshProjects,
    }),
    [projects, activeProject, activeProjectSlug, loading, error, setActiveProject, refreshProjects]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjectContext must be used inside ProjectProvider");
  return ctx;
}
