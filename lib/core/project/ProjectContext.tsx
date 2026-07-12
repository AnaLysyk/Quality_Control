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
import { useAuth } from "@/context/AuthContext";

export type ProjectRecord = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  status: string;
  color?: string | null;
  iconKey?: string | null;
  companyId: string;
  source?: string | null;
  qaseProjectCode?: string | null;
  jiraProjectKey?: string | null;
  manualCreationDisabled?: boolean;
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

const storageKey = (userId: string, companyId: string) => `activeProject:${userId}:${companyId}`;
const projectCacheKey = (userId: string, companySlug: string) => `projects:${userId}:${companySlug}`;
const PROJECT_CACHE_TTL_MS = 60_000;
const getSessionStorage = () => (typeof window === "undefined" ? null : window.sessionStorage);

type ProjectCacheEntry = {
  projects: ProjectRecord[];
  cachedAt: number;
};

const projectMemoryCache = new Map<string, ProjectCacheEntry>();

function isFreshProjectCache(entry: ProjectCacheEntry | null) {
  return Boolean(entry && Date.now() - entry.cachedAt <= PROJECT_CACHE_TTL_MS);
}

function readProjectCache(userId: string, companySlug: string): ProjectRecord[] | null {
  const key = projectCacheKey(userId, companySlug);
  const memoryEntry = projectMemoryCache.get(key) ?? null;
  if (isFreshProjectCache(memoryEntry)) return memoryEntry?.projects ?? null;

  try {
    const raw = getSessionStorage()?.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProjectCacheEntry;
    if (!isFreshProjectCache(parsed) || !Array.isArray(parsed.projects)) return null;
    projectMemoryCache.set(key, parsed);
    return parsed.projects;
  } catch {
    return null;
  }
}

function writeProjectCache(userId: string, companySlug: string, projects: ProjectRecord[]) {
  const key = projectCacheKey(userId, companySlug);
  const entry: ProjectCacheEntry = { projects, cachedAt: Date.now() };
  projectMemoryCache.set(key, entry);
  try {
    getSessionStorage()?.setItem(key, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toProjectRecord(item: Partial<ProjectRecord>, companySlug: string): ProjectRecord | null {
  const name = typeof item.name === "string" ? item.name.trim() : "";
  const slug = typeof item.slug === "string" && item.slug.trim() ? normalizeSlug(item.slug) : normalizeSlug(name);
  if (!name || !slug) return null;

  return {
    id: item.id ?? `${item.source ?? "project"}-${slug}`,
    slug,
    name,
    description: item.description ?? null,
    status: item.status ?? "active",
    color: item.color ?? null,
    iconKey: item.iconKey ?? "folder",
    companyId: item.companyId ?? companySlug,
    source: item.source ?? (item.qaseProjectCode ? "qase" : "manual"),
    qaseProjectCode: item.qaseProjectCode ?? null,
    jiraProjectKey: item.jiraProjectKey ?? null,
    manualCreationDisabled: item.manualCreationDisabled ?? false,
    createdAt: item.createdAt ?? null,
  };
}

function mergeProjects(projects: ProjectRecord[]) {
  const merged = new Map<string, ProjectRecord>();
  for (const project of projects) {
    const key = project.qaseProjectCode ? `qase:${project.qaseProjectCode.toUpperCase()}` : project.slug;
    if (!merged.has(key)) merged.set(key, project);
  }
  return Array.from(merged.values()).sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }),
  );
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { activeClient, activeClientSlug } = useClientContext();
  const { user } = useAuth();
  const userId = user?.id ?? "anonymous";

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectSlug, setActiveProjectSlugState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveActiveProjectSlug = useCallback(
    (list: ProjectRecord[], companySlug: string) => {
      if (list.length === 0) return null;

      const storage = getSessionStorage();
      const companyId = activeClient?.id ?? companySlug;
      const key = storageKey(userId, companyId);
      const stored = storage?.getItem(key) ?? null;
      const storedProject = stored
        ? list.find((p) => p.slug === stored || p.id === stored || p.qaseProjectCode === stored) ?? null
        : null;

      const resolved = storedProject?.slug ?? list[0].slug;
      storage?.setItem(key, resolved);
      return resolved;
    },
    [activeClient?.id, userId],
  );

  const applyProjectList = useCallback(
    (list: ProjectRecord[], companySlug: string) => {
      setProjects(list);
      setActiveProjectSlugState(resolveActiveProjectSlug(list, companySlug));
    },
    [resolveActiveProjectSlug],
  );

  const fetchProjects = useCallback(
    async (companySlug: string, options?: { force?: boolean }) => {
      const cached = options?.force ? null : readProjectCache(userId, companySlug);
      if (cached) {
        applyProjectList(cached, companySlug);
      }

      setLoading(true);
      setError(null);
      try {
        const projectRes = await fetch(`/api/projects?companySlug=${encodeURIComponent(companySlug)}`, {
          cache: "no-store",
          credentials: "include",
        });

        if (!projectRes.ok) throw new Error("Falha ao carregar projetos");

        const projectJson = (await projectRes.json().catch(() => null)) as { projects?: Partial<ProjectRecord>[] } | null;
        const list = mergeProjects(
          (projectJson?.projects ?? [])
            .map((item) => toProjectRecord(item, companySlug))
            .filter(Boolean) as ProjectRecord[],
        );

        writeProjectCache(userId, companySlug, list);
        applyProjectList(list, companySlug);
        return list;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao carregar projetos";
        setError(msg);
        if (!cached) setProjects([]);
        return cached ?? [];
      } finally {
        setLoading(false);
      }
    },
    [applyProjectList, userId],
  );

  useEffect(() => {
    if (!activeClientSlug) {
      const timeoutId = window.setTimeout(() => {
        setProjects([]);
        setActiveProjectSlugState(null);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      const cached = readProjectCache(userId, activeClientSlug);
      if (cached) applyProjectList(cached, activeClientSlug);

      void fetchProjects(activeClientSlug, { force: true }).then((list) => {
        if (cancelled) return;
        applyProjectList(list, activeClientSlug);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeClientSlug, applyProjectList, fetchProjects, userId]);

  const setActiveProject = useCallback(
    (slugOrId: string | null) => {
      const companyId = activeClient?.id;
      if (!slugOrId) {
        setActiveProjectSlugState(null);
        if (companyId) getSessionStorage()?.removeItem(storageKey(userId, companyId));
        return;
      }
      const found = projects.find((p) => p.slug === slugOrId || p.id === slugOrId || p.qaseProjectCode === slugOrId);
      if (!found) return;
      setActiveProjectSlugState(found.slug);
      if (companyId) {
        getSessionStorage()?.setItem(storageKey(userId, companyId), found.slug);
      }
    },
    [projects, activeClient, userId],
  );

  const refreshProjects = useCallback(async () => {
    if (!activeClientSlug) return;
    await fetchProjects(activeClientSlug, { force: true });
  }, [activeClientSlug, fetchProjects]);

  const activeProject = useMemo(
    () => (activeProjectSlug ? projects.find((p) => p.slug === activeProjectSlug) ?? null : null),
    [projects, activeProjectSlug],
  );

  useEffect(() => {
    const root = document.documentElement;

    if (activeProjectSlug) root.dataset.project = activeProjectSlug;
    else delete root.dataset.project;

    if (activeProject?.id) root.dataset.projectId = activeProject.id;
    else delete root.dataset.projectId;
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
    [projects, activeProject, activeProjectSlug, loading, error, setActiveProject, refreshProjects],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjectContext deve ser usado dentro de ProjectProvider");
  return ctx;
}
