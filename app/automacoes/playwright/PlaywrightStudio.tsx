"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiCode,
  FiCopy,
  FiCpu,
  FiEdit2,
  FiFile,
  FiFilePlus,
  FiFolder,
  FiFolderPlus,
  FiGithub,
  FiList,
  FiMonitor,
  FiPlay,
  FiRefreshCw,
  FiSave,
  FiSettings,
  FiTerminal,
  FiTrash2,
  FiUploadCloud,
  FiX,
  FiZap,
} from "react-icons/fi";
import { useProjectContext } from "@/lib/core/project/ProjectContext";

// Monaco Editor is large — load dynamically to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// â”€â”€ DB helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type DbScript = {
  id: string;
  path: string;
  content: string;
  status: string;
  updated_at: string;
};

function detectLanguage(path: string): "typescript" | "javascript" | "json" {
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".js") || path.endsWith(".cjs") || path.endsWith(".mjs")) return "javascript";
  return "typescript";
}

function buildTreeFromDbScripts(scripts: DbScript[]): ProjectTree | null {
  if (scripts.length === 0) return null;

  const configScript = scripts.find((s) => s.path === "playwright.config.ts");
  const others = scripts.filter((s) => s.path !== "playwright.config.ts");

  const folderMap = new Map<string, ProjectFile[]>();
  for (const s of others) {
    const parts = s.path.split("/");
    const folderName = parts.length > 1 ? parts[0] : "__root__";
    const fileName = parts[parts.length - 1];
    if (!folderMap.has(folderName)) folderMap.set(folderName, []);
    folderMap.get(folderName)!.push({
      id: `dbf:${s.path}`,
      name: fileName,
      path: s.path,
      content: s.content,
      language: detectLanguage(s.path),
      status: (s.status as WorkflowStatus) ?? "not_started",
      updatedAt: s.updated_at,
    });
  }

  const folders: ProjectFolder[] = Array.from(folderMap.entries()).map(([name, files]) => ({
    id: `dbfolder:${name}`,
    name,
    expanded: true,
    children: files,
  }));

  const defaultTree = buildDefaultTree();
  return {
    id: "root",
    name: "Projeto",
    folders,
    configFile: configScript
      ? {
          id: "dbf:playwright.config.ts",
          name: "playwright.config.ts",
          path: "playwright.config.ts",
          content: configScript.content,
          language: "typescript",
          status: (configScript.status as WorkflowStatus) ?? "not_started",
          updatedAt: configScript.updated_at,
        }
      : defaultTree.configFile,
  };
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type WorkflowStatus = "not_started" | "draft" | "published";

type ProjectFile = {
  id: string;
  name: string;
  path: string;
  content: string;
  language: "typescript" | "javascript" | "json";
  status: WorkflowStatus;
  updatedAt: string;
};

type ProjectFolder = {
  id: string;
  name: string;
  children: (ProjectFolder | ProjectFile)[];
  expanded: boolean;
};

type ProjectTree = {
  id: string;
  name: string;
  folders: ProjectFolder[];
  configFile: ProjectFile;
};

type PlaywrightConfig = {
  baseURL: string;
  browser: "chromium" | "firefox" | "webkit";
  browsers: Array<"chromium" | "firefox" | "webkit">;
  headless: boolean;
  timeout: number;
  workers: number;
  retries: number;
  screenshotOn: "off" | "on" | "only-on-failure";
  videoOn: "off" | "on" | "retain-on-failure";
};

type TerminalLine = {
  id: string;
  ts: string;
  type: "info" | "success" | "error" | "warn" | "system";
  text: string;
};

type RightPanelTab = "config" | "terminal" | "runs" | "agents";
type AgentPanelTab = "planner" | "generator" | "healer";

type RunRecord = {
  id: string;
  project_id?: string | null;
  title: string;
  browser: string;
  status: string;
  run_mode?: "all" | "changed" | "failed";
  selected_specs?: string[];
  source_run_id?: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  exit_code: number | null;
};

type RunResultRecord = {
  id: string;
  spec_file: string;
  title: string;
  status: string;
  duration_ms: number;
  error_msg: string | null;
  created_at: string;
};

type CompanyOption = { name: string; slug: string };

type RunComparison = {
  compareTo: string;
  regressions: number;
  improvements: number;
  unchanged: number;
  newItems: number;
  byKey: Record<string, "regression" | "improvement" | "same" | "new">;
};

type RepositoryTestCase = {
  id: string;
  key?: string;
  title: string;
  description?: string;
  steps?: Array<{ action?: string; expectedResult?: string }>;
};

type TestProjectOption = {
  id: string;
  code: string | null;
  name: string;
  source: "internal" | "qase";
  applicationId: string | null;
  applicationName: string | null;
  casesCount: number;
};

type TestPlanOption = {
  id: string;
  title: string;
  source: "manual" | "qase";
  projectCode?: string | null;
  applicationId?: string | null;
  casesCount?: number;
};

const RUN_STATUS_FILTER_STORAGE_KEY = "pwStudio.runStatusFilter";
const RUN_SEARCH_QUERY_STORAGE_KEY = "pwStudio.runSearchQuery";
const RUN_COMPARE_TO_STORAGE_KEY = "pwStudio.runCompareTo";

// â”€â”€ Default templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BASE_PAGE_TEMPLATE = `import { Page } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate(path: string) {
    await this.page.goto(path);
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async getTitle() {
    return this.page.title();
  }
}
`;

const LOGIN_PAGE_TEMPLATE = `import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  private readonly emailInput = '[data-testid="email"]';
  private readonly passwordInput = '[data-testid="password"]';
  private readonly submitButton = '[data-testid="submit"]';
  private readonly errorMessage = '[data-testid="error"]';

  constructor(page: Page) {
    super(page);
  }

  async fillCredentials(email: string, password: string) {
    await this.page.fill(this.emailInput, email);
    await this.page.fill(this.passwordInput, password);
  }

  async submit() {
    await this.page.click(this.submitButton);
    await this.waitForLoad();
  }

  async login(email: string, password: string) {
    await this.fillCredentials(email, password);
    await this.submit();
  }

  async getError() {
    return this.page.textContent(this.errorMessage);
  }
}
`;

const LOGIN_SPEC_TEMPLATE = `import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.describe('Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate('/login');
  });

  test('should login with valid credentials', async ({ page }) => {
    await loginPage.login('admin@example.com', 'password123');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should show error with invalid credentials', async () => {
    await loginPage.login('wrong@example.com', 'wrongpass');
    const error = await loginPage.getError();
    expect(error).toBeTruthy();
  });

  test('should redirect unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });
});
`;

const PLAYWRIGHT_CONFIG_TEMPLATE = (baseURL: string) => `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: '${baseURL}',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
`;

const NEW_SPEC_TEMPLATE = (name: string) => `import { test, expect } from '@playwright/test';

test.describe('${name}', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render correctly', async ({ page }) => {
    await expect(page).toHaveTitle(/.+/);
  });
});
`;

const NEW_PAGE_TEMPLATE = (name: string) => `import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ${name} extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async isLoaded() {
    await this.page.waitForLoadState('networkidle');
    return true;
  }
}
`;

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function now() {
  return new Date().toISOString();
}

function buildDefaultTree(): ProjectTree {
  const configFile: ProjectFile = {
    id: uid(),
    name: "playwright.config.ts",
    path: "playwright.config.ts",
    content: PLAYWRIGHT_CONFIG_TEMPLATE("http://localhost:3000"),
    language: "typescript",
    status: "draft",
    updatedAt: now(),
  };

  return {
    id: uid(),
    name: "Meu Projeto",
    configFile,
    folders: [
      {
        id: uid(),
        name: "pages",
        expanded: true,
        children: [
          {
            id: uid(),
            name: "BasePage.ts",
            path: "pages/BasePage.ts",
            content: BASE_PAGE_TEMPLATE,
            language: "typescript",
            status: "draft",
            updatedAt: now(),
          } as ProjectFile,
          {
            id: uid(),
            name: "LoginPage.ts",
            path: "pages/LoginPage.ts",
            content: LOGIN_PAGE_TEMPLATE,
            language: "typescript",
            status: "draft",
            updatedAt: now(),
          } as ProjectFile,
        ],
      },
      {
        id: uid(),
        name: "tests",
        expanded: true,
        children: [
          {
            id: uid(),
            name: "login.spec.ts",
            path: "tests/login.spec.ts",
            content: LOGIN_SPEC_TEMPLATE,
            language: "typescript",
            status: "not_started",
            updatedAt: now(),
          } as ProjectFile,
        ],
      },
    ],
  };
}

function isFile(node: ProjectFolder | ProjectFile): node is ProjectFile {
  return "content" in node;
}

function getAllFiles(tree: ProjectTree): ProjectFile[] {
  const files: ProjectFile[] = [tree.configFile];
  function walk(nodes: (ProjectFolder | ProjectFile)[]) {
    for (const node of nodes) {
      if (isFile(node)) files.push(node);
      else walk(node.children);
    }
  }
  walk(tree.folders);
  return files;
}

function updateFileInTree(
  tree: ProjectTree,
  fileId: string,
  updater: (f: ProjectFile) => ProjectFile,
): ProjectTree {
  if (tree.configFile.id === fileId) {
    return { ...tree, configFile: updater(tree.configFile) };
  }
  function walkFolders(folders: ProjectFolder[]): ProjectFolder[] {
    return folders.map((folder) => ({
      ...folder,
      children: folder.children.map((child) => {
        if (isFile(child)) return child.id === fileId ? updater(child) : child;
        return { ...child, children: walkFolders([child])[0].children };
      }),
    }));
  }
  return { ...tree, folders: walkFolders(tree.folders) };
}

function deleteFileInTree(tree: ProjectTree, fileId: string): ProjectTree {
  function walkFolders(folders: ProjectFolder[]): ProjectFolder[] {
    return folders.map((folder) => ({
      ...folder,
      children: folder.children
        .filter((child) => {
          if (isFile(child)) return child.id !== fileId;
          return true;
        })
        .map((child) => {
          if (isFile(child)) return child;
          return { ...child, children: walkFolders([child])[0].children };
        }),
    }));
  }
  return { ...tree, folders: walkFolders(tree.folders) };
}

function toggleFolderInTree(tree: ProjectTree, folderId: string): ProjectTree {
  function walkFolders(folders: ProjectFolder[]): ProjectFolder[] {
    return folders.map((folder) => {
      if (folder.id === folderId) return { ...folder, expanded: !folder.expanded };
      return {
        ...folder,
        children: walkFolders(
          folder.children.filter((c) => !isFile(c)) as ProjectFolder[],
        ),
      };
    });
  }
  return { ...tree, folders: walkFolders(tree.folders) };
}

// â”€â”€ Status badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STATUS_LABELS: Record<WorkflowStatus, string> = {
  not_started: "Não iniciado",
  draft: "Rascunho",
  published: "Publicado",
};

const STATUS_COLORS: Record<WorkflowStatus, string> = {
  not_started: "bg-gray-100 text-gray-500 border-gray-200",
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function StatusBadge({ status }: { status: WorkflowStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[status]}`}
    >
      {status === "not_started" && <FiAlertCircle className="h-3 w-3" />}
      {status === "draft" && <FiEdit2 className="h-3 w-3" />}
      {status === "published" && <FiCheckCircle className="h-3 w-3" />}
      {STATUS_LABELS[status]}
    </span>
  );
}

// â”€â”€ Terminal line colors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TERM_COLORS: Record<TerminalLine["type"], string> = {
  system: "text-blue-400",
  info: "text-zinc-400",
  success: "text-emerald-400",
  error: "text-red-400",
  warn: "text-amber-400",
};

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Props = {
  activeCompanySlug: string | null;
  companies: CompanyOption[];
  /** When set (usually from the automation queue), loads the linked draft + manual test case into the IDE on mount. */
  testCaseId?: string | null;
  draftId?: string | null;
};

type LinkedTestCase = {
  id: string;
  key?: string;
  title: string;
  objective?: string | null;
  steps: Array<{ id: string; order: number; action: string; expectedResult: string }>;
};

export default function PlaywrightStudio({ activeCompanySlug, companies, testCaseId, draftId }: Props) {
  const { activeProjectId, activeProject } = useProjectContext();
  const [tree, setTree] = useState<ProjectTree>(buildDefaultTree);
  const [activeFileId, setActiveFileId] = useState<string | null>(() => {
    const t = buildDefaultTree();
    return (t.folders[1]?.children[0] as ProjectFile | undefined)?.id ?? t.configFile.id;
  });
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [rightTab, setRightTab] = useState<RightPanelTab>("config");
  const [config, setConfig] = useState<PlaywrightConfig>({
    baseURL: "http://localhost:3000",
    browser: "chromium",
    browsers: ["chromium"],
    headless: false,
    timeout: 30000,
    workers: 2,
    retries: 0,
    screenshotOn: "only-on-failure",
    videoOn: "retain-on-failure",
  });
  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(
    activeCompanySlug ?? companies[0]?.slug ?? null,
  );
  const [contextMenu, setContextMenu] = useState<{
    fileId: string;
    x: number;
    y: number;
  } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addingIn, setAddingIn] = useState<{
    folderId: string | null;
    kind: "file" | "folder";
  } | null>(null);
  const [addingName, setAddingName] = useState("");
  const [dbLoading, setDbLoading] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [openBrowserOnRun, setOpenBrowserOnRun] = useState(true);
  const [linkedTestCase, setLinkedTestCase] = useState<LinkedTestCase | null>(null);
  const [linkedBannerOpen, setLinkedBannerOpen] = useState(true);

  // â”€â”€ Runs + Agents state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [compareToRunId, setCompareToRunId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(RUN_COMPARE_TO_STORAGE_KEY) ?? "";
  });
  const [runHistory, setRunHistory] = useState<RunRecord[]>([]);
  const [runDetails, setRunDetails] = useState<Record<string, RunResultRecord[]>>({});
  const [runComparisons, setRunComparisons] = useState<Record<string, RunComparison | null>>({});
  const [runMode, setRunMode] = useState<"all" | "changed" | "failed">("all");
  const [execMode, setExecMode] = useState<"spec" | "script">("spec");
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [runStatusFilter, setRunStatusFilter] = useState<"all" | "queued" | "running" | "passed" | "failed" | "error">(() => {
    if (typeof window === "undefined") return "all";
    const raw = window.localStorage.getItem(RUN_STATUS_FILTER_STORAGE_KEY);
    if (raw === "queued" || raw === "running" || raw === "passed" || raw === "failed" || raw === "error") {
      return raw;
    }
    return "all";
  });
  const [runSearchQuery, setRunSearchQuery] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(RUN_SEARCH_QUERY_STORAGE_KEY) ?? "";
  });
  const [runsLoading, setRunsLoading] = useState(false);
  const [agentTab, setAgentTab] = useState<AgentPanelTab>("planner");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentResult, setAgentResult] = useState<string | null>(null);
  const [plannerInput, setPlannerInput] = useState("");
  const [generatorInput, setGeneratorInput] = useState("");
  const [generatorTargetType, setGeneratorTargetType] = useState<"playwright" | "api">("playwright");
  const [generatorTargetFile, setGeneratorTargetFile] = useState("tests/generated.spec.ts");
  const [healerError, setHealerError] = useState("");
  const [repositoryCases, setRepositoryCases] = useState<RepositoryTestCase[]>([]);
  const [selectedRepositoryCaseId, setSelectedRepositoryCaseId] = useState("");
  const [testProjects, setTestProjects] = useState<TestProjectOption[]>([]);
  const [selectedTestProjectId, setSelectedTestProjectId] = useState("");
  const [testPlans, setTestPlans] = useState<TestPlanOption[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [flowCaseTitle, setFlowCaseTitle] = useState("Caso E2E Playwright - Quality Control");
  const [flowCaseDescription, setFlowCaseDescription] = useState("Validar fluxo crítico do sistema em produção controlada.");
  const [flowRepository, setFlowRepository] = useState("TestingCompany/quality-control-e2e");
  const [flowBranch, setFlowBranch] = useState("main");
  const [flowBusy, setFlowBusy] = useState(false);

  const griauleCompany = useMemo(
    () => companies.find((company) => /griaule/i.test(company.slug) || /griaule/i.test(company.name)) ?? null,
    [companies],
  );

  const terminalRef = useRef<HTMLDivElement>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const previewWindowRef = useRef<Window | null>(null);

  // â”€â”€ Detect app theme for Monaco â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  // â”€â”€ DB: load scripts on company change â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    if (!selectedCompany) return;
    let cancelled = false;
    setDbLoading(true);
    fetch(
      `/api/automations/scripts?companySlug=${encodeURIComponent(selectedCompany)}`,
    )
      .then((r) => r.json())
      .then((data: { scripts?: DbScript[] }) => {
        if (cancelled) return;
        const built = buildTreeFromDbScripts(data.scripts ?? []);
        if (built) setTree(built);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDbLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCompany]);

  // Set context menu position imperatively
  useLayoutEffect(() => {
    if (!ctxMenuRef.current || !contextMenu) return;
    ctxMenuRef.current.style.left = `${contextMenu.x}px`;
    ctxMenuRef.current.style.top = `${contextMenu.y}px`;
  }, [contextMenu]);

  // Ensure active file is in open tabs
  useEffect(() => {
    if (!activeFileId) return;
    setOpenFileIds((prev) =>
      prev.includes(activeFileId) ? prev : [...prev, activeFileId],
    );
  }, [activeFileId]);

  // Load a manual test case + its automation draft (from the automation queue) into the IDE
  useEffect(() => {
    if (!testCaseId) return;
    let canceled = false;

    async function loadLinkedCase() {
      try {
        const caseRes = await fetch(`/api/test-cases/${encodeURIComponent(testCaseId!)}`);
        if (!caseRes.ok) return;
        const caseData = (await caseRes.json()) as {
          testCase: { id: string; key?: string; title: string; objective?: string | null };
          steps: Array<{ id: string; order: number; action: string; expectedResult: string }>;
        };
        if (canceled) return;
        setLinkedTestCase({
          id: caseData.testCase.id,
          key: caseData.testCase.key,
          title: caseData.testCase.title,
          objective: caseData.testCase.objective,
          steps: caseData.steps ?? [],
        });

        if (!draftId) return;
        const draftRes = await fetch(`/api/test-cases/${encodeURIComponent(testCaseId!)}/automation/drafts/${encodeURIComponent(draftId)}`);
        if (!draftRes.ok) return;
        const draft = (await draftRes.json()) as { specFile?: string | null; specCode?: string | null };
        if (canceled || !draft.specCode) return;

        const filePath = draft.specFile || `tests/${caseData.testCase.key ?? testCaseId}.spec.ts`;
        const fileName = filePath.split("/").pop() ?? "case.spec.ts";
        const newFile: ProjectFile = {
          id: uid(),
          name: fileName,
          path: filePath,
          content: draft.specCode,
          language: "typescript",
          status: "draft",
          updatedAt: now(),
        };
        setTree((prev) => ({
          ...prev,
          folders: prev.folders.map((f) =>
            f.name === "tests" ? { ...f, children: [...f.children.filter((c) => !("path" in c) || c.path !== filePath), newFile] } : f,
          ),
        }));
        setActiveFileId(newFile.id);
      } catch {
        // Best-effort: IDE still opens even if the linked case/draft can't be loaded.
      }
    }

    void loadLinkedCase();
    return () => {
      canceled = true;
    };
  }, [testCaseId, draftId]);

  // Init open tabs with first spec
  useEffect(() => {
    const files = getAllFiles(tree);
    const spec = files.find((f) => f.path.includes("tests/"));
    if (spec) setActiveFileId(spec.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminal]);

  // Load run history when company changes
  const loadRuns = useCallback(async (slug: string) => {
    if (!slug) return;
    setRunsLoading(true);
    try {
      const qs = new URLSearchParams({ companySlug: slug });
      if (activeProjectId) qs.set("projectId", activeProjectId);
      const res = await fetch(`/api/playwright/run?${qs.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as { runs: RunRecord[] };
        setRunHistory(data.runs ?? []);
      }
    } catch {
      // ignore
    } finally {
      setRunsLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (selectedCompany) void loadRuns(selectedCompany);
  }, [selectedCompany, activeProjectId, loadRuns]);

  useEffect(() => {
    if (!selectedCompany) return;
    let cancelled = false;
    void fetch(`/api/test-cases?companySlug=${encodeURIComponent(selectedCompany)}&includeIntegrated=true`)
      .then((r) => r.json())
      .then((data: { items?: Array<{ testCase?: RepositoryTestCase }> }) => {
        if (cancelled) return;
        const items = Array.isArray(data.items)
          ? data.items
              .map((item) => item.testCase)
              .filter((item): item is RepositoryTestCase => Boolean(item && item.id && item.title))
          : [];
        setRepositoryCases(items);
      })
      .catch(() => {
        if (cancelled) return;
        setRepositoryCases([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCompany]);

  useEffect(() => {
    if (!activeRunId) return;
    if (runDetails[activeRunId] && runComparisons[activeRunId] !== undefined) return;
    let cancelled = false;
    const compareParam = compareToRunId ? `?compareTo=${encodeURIComponent(compareToRunId)}` : "";
    void fetch(`/api/playwright/run/${activeRunId}${compareParam}`)
      .then((r) => r.json())
      .then((data: { results?: RunResultRecord[]; comparison?: RunComparison | null }) => {
        if (cancelled) return;
        setRunDetails((prev) => ({ ...prev, [activeRunId]: data.results ?? [] }));
        setRunComparisons((prev) => ({ ...prev, [activeRunId]: data.comparison ?? null }));
      })
      .catch(() => {
        if (cancelled) return;
        setRunDetails((prev) => ({ ...prev, [activeRunId]: [] }));
        setRunComparisons((prev) => ({ ...prev, [activeRunId]: null }));
      });
    return () => {
      cancelled = true;
    };
  }, [activeRunId, runDetails, runComparisons, compareToRunId]);

  useEffect(() => {
    window.localStorage.setItem(RUN_STATUS_FILTER_STORAGE_KEY, runStatusFilter);
  }, [runStatusFilter]);

  useEffect(() => {
    window.localStorage.setItem(RUN_SEARCH_QUERY_STORAGE_KEY, runSearchQuery);
  }, [runSearchQuery]);

  useEffect(() => {
    window.localStorage.setItem(RUN_COMPARE_TO_STORAGE_KEY, compareToRunId);
  }, [compareToRunId]);

  // Derived: active file object
  const activeFile = useMemo(() => {
    if (!activeFileId) return null;
    return getAllFiles(tree).find((f) => f.id === activeFileId) ?? null;
  }, [activeFileId, tree]);

  const openFiles = useMemo(() => {
    const all = getAllFiles(tree);
    return openFileIds
      .map((id) => all.find((f) => f.id === id))
      .filter(Boolean) as ProjectFile[];
  }, [openFileIds, tree]);

  const allFiles = useMemo(() => getAllFiles(tree), [tree]);
  const specFiles = useMemo(
    () => allFiles.filter((file) => /(^|\/)tests\/.+\.spec\.(ts|js)$/i.test(file.path)),
    [allFiles],
  );
  const publishedSpecCount = useMemo(
    () => specFiles.filter((file) => file.status === "published").length,
    [specFiles],
  );
  const hasRunnableSpecs = specFiles.length > 0;
  const selectedRepositoryCase = useMemo(
    () => repositoryCases.find((item) => item.id === selectedRepositoryCaseId) ?? null,
    [repositoryCases, selectedRepositoryCaseId],
  );
  const selectedTestProject = useMemo(
    () => testProjects.find((project) => project.id === selectedTestProjectId) ?? null,
    [testProjects, selectedTestProjectId],
  );

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const addTerminalLine = useCallback(
    (type: TerminalLine["type"], text: string) => {
      const ts = new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setTerminal((prev) => [...prev, { id: uid(), ts, type, text }]);
    },
    [],
  );

  const resolvePreviewUrl = useCallback(() => {
    if (typeof window === "undefined") return null;
    const raw = config.baseURL.trim() || window.location.origin;
    try {
      return new URL(raw, window.location.origin).href;
    } catch {
      return null;
    }
  }, [config.baseURL]);

  const openPreviewTab = useCallback(() => {
    if (typeof window === "undefined") return;
    const previewUrl = resolvePreviewUrl();
    if (!previewUrl) {
      addTerminalLine("warn", "Base URL invalida. Corrija a URL antes de abrir a previa.");
      return;
    }

    try {
      const current = previewWindowRef.current;
      const previewWindow =
        current && !current.closed
          ? current
          : window.open(previewUrl, "playwright-live-preview");

      if (!previewWindow) {
        addTerminalLine("warn", "O navegador bloqueou a aba de previa. Permita pop-ups para esta pagina e execute novamente.");
        return;
      }

      previewWindowRef.current = previewWindow;
      previewWindow.location.href = previewUrl;
      previewWindow.focus();
      addTerminalLine("system", `Aba de previa aberta: ${previewUrl}`);
    } catch (err) {
      addTerminalLine("warn", `Nao foi possivel abrir a previa: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [addTerminalLine, resolvePreviewUrl]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!activeFileId || value === undefined) return;
      setTree((prev) =>
        updateFileInTree(prev, activeFileId, (f) => ({
          ...f,
          content: value,
          status: f.status === "not_started" ? "draft" : f.status,
          updatedAt: now(),
        })),
      );
    },
    [activeFileId],
  );

  const handleSave = useCallback(() => {
    if (!activeFileId) return;
    setTree((prev) =>
      updateFileInTree(prev, activeFileId, (f) => ({
        ...f,
        status: f.status === "not_started" ? "draft" : f.status,
        updatedAt: now(),
      })),
    );
    addTerminalLine("success", `Arquivo salvo: ${activeFile?.name}`);
    if (activeFile && selectedCompany) {
      const newStatus =
        activeFile.status === "not_started" ? "draft" : activeFile.status;
      void fetch("/api/automations/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug: selectedCompany,
          path: activeFile.path,
          content: activeFile.content,
          status: newStatus,
        }),
      });
    }
  }, [activeFileId, activeFile, addTerminalLine, selectedCompany]);

  const handlePublish = useCallback(() => {
    if (!activeFileId) return;
    setTree((prev) =>
      updateFileInTree(prev, activeFileId, (f) => ({
        ...f,
        status: "published",
        updatedAt: now(),
      })),
    );
    addTerminalLine(
      "success",
      `Publicado: ${activeFile?.name} → visível para a empresa`,
    );
    if (activeFile && selectedCompany) {
      void fetch("/api/automations/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug: selectedCompany,
          path: activeFile.path,
          content: activeFile.content,
          status: "published",
        }),
      });
    }
  }, [activeFileId, activeFile, addTerminalLine, selectedCompany]);

  const handleRun = useCallback(async (mode?: "all" | "changed" | "failed") => {
    if (isRunning || !selectedCompany) return;
    const effectiveMode = mode ?? runMode;
    if (!hasRunnableSpecs && effectiveMode !== "failed") {
      setRightTab("terminal");
      addTerminalLine("error", "Nenhum arquivo de teste .spec.ts/.spec.js encontrado em tests/. Crie ou gere um spec antes de executar.");
      return;
    }

    const sourceRunId =
      effectiveMode === "failed"
        ? runHistory.find((run) => run.status === "failed" || run.status === "error")?.id ?? null
        : null;
    if (effectiveMode === "failed" && !sourceRunId) {
      setRightTab("runs");
      addTerminalLine("warn", "Nenhuma execução com falha encontrada para reexecutar.");
      return;
    }

    setIsRunning(true);
    setRightTab("terminal");
    setTerminal([]);

    const scripts = getAllFiles(tree).map((f) => ({ path: f.path, content: f.content }));
    const selectedBrowsers = openBrowserOnRun
      ? [config.browser]
      : Array.from(new Set(config.browsers));
    if (!selectedBrowsers.length) {
      setRightTab("config");
      addTerminalLine("error", "Selecione ao menos um navegador para executar.");
      setIsRunning(false);
      return;
    }
    const runtimeHeadless = openBrowserOnRun ? false : config.headless;
    const runtimeWorkers = openBrowserOnRun ? 1 : config.workers;

    if (openBrowserOnRun) {
      openPreviewTab();
      addTerminalLine("system", "Modo IDE ativo: Playwright vai rodar com navegador visivel, 1 worker e uma aba de previa aberta.");
      if (config.headless || config.workers !== 1 || config.browsers.length !== 1 || config.browsers[0] !== config.browser) {
        setConfig((prev) => ({
          ...prev,
          browsers: [prev.browser],
          headless: false,
          workers: 1,
        }));
      }
    }

    try {
      // 1. Start the run — get back a runId
      const startRes = await fetch("/api/playwright/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug: selectedCompany,
          projectId: activeProjectId ?? undefined,
          planId: selectedPlanId || undefined,
          title: `${effectiveMode === "changed" ? "Execução changed specs" : effectiveMode === "failed" ? "Rerun failed" : "Execução manual"} — ${new Date().toLocaleString("pt-BR")}`,
          runMode: effectiveMode,
          sourceRunId: sourceRunId ?? undefined,
          scripts,
          config: {
            baseURL: config.baseURL,
            browser: config.browser,
            browsers: selectedBrowsers,
            headless: runtimeHeadless,
            timeoutMs: config.timeout,
            workers: runtimeWorkers,
            retries: config.retries,
            screenshotOn: config.screenshotOn,
            videoOn: config.videoOn,
            traceOn: "off",
          },
        }),
      });

      if (!startRes.ok) {
        const err = (await startRes.json().catch(() => ({ error: "Erro desconhecido" }))) as { error?: string };
        addTerminalLine("error", `Falha ao iniciar: ${err.error ?? startRes.statusText}`);
        setIsRunning(false);
        return;
      }

      const { runId, selectedSpecs } = (await startRes.json()) as { runId: string; selectedSpecs?: string[] };
      setActiveRunId(runId);
      addTerminalLine("system", `â–º Run iniciada — ID: ${runId}`);
      if (Array.isArray(selectedSpecs)) {
        addTerminalLine("system", `Escopo: ${selectedSpecs.length} spec(s).`);
      }

      // 2. Stream SSE output
      const evtSource = new EventSource(`/api/playwright/run/${runId}/events`);

      evtSource.onmessage = (e) => {
        const data = JSON.parse(e.data) as { type: string; line?: string; status?: string };
        if (data.type === "line" && data.line) {
          const raw = data.line;
          let type: TerminalLine["type"] = "info";
          if (raw.startsWith("[system]")) type = "system";
          else if (raw.startsWith("[error]")) type = "error";
          else if (raw.startsWith("[stderr]")) type = "warn";
          else if (raw.includes("passed") || raw.includes("âœ“")) type = "success";
          else if (raw.includes("failed") || raw.includes("âœ˜")) type = "error";
          const text = raw.replace(/^\[(system|stdout|stderr|error)\]\s?/, "");
          addTerminalLine(type, text);
        } else if (data.type === "done") {
          evtSource.close();
          setIsRunning(false);
          setRightTab("runs");
          if (selectedCompany) void loadRuns(selectedCompany);
        }
      };

      evtSource.onerror = () => {
        evtSource.close();
        setIsRunning(false);
        setRightTab("runs");
        if (selectedCompany) void loadRuns(selectedCompany);
      };
    } catch (err) {
      addTerminalLine("error", `Erro: ${err instanceof Error ? err.message : String(err)}`);
      setIsRunning(false);
    }
  }, [isRunning, selectedCompany, activeProjectId, selectedPlanId, runMode, runHistory, tree, config, openBrowserOnRun, addTerminalLine, openPreviewTab, loadRuns, hasRunnableSpecs]);

  const handleRunScript = useCallback(async () => {
    if (isRunning || !selectedCompany) return;
    if (!activeFile || !activeFile.content.trim()) {
      setRightTab("terminal");
      addTerminalLine("error", "Abra ou escreva um script antes de executar.");
      return;
    }

    setIsRunning(true);
    setRightTab("terminal");
    setTerminal([]);

    try {
      const startRes = await fetch("/api/automations/scripts/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug: selectedCompany,
          title: `Script ${activeFile.name} — ${new Date().toLocaleString("pt-BR")}`,
          scriptContent: activeFile.content,
        }),
      });

      if (!startRes.ok) {
        const err = (await startRes.json().catch(() => ({ error: "Erro desconhecido" }))) as { error?: string };
        addTerminalLine("error", `Falha ao iniciar: ${err.error ?? startRes.statusText}`);
        setIsRunning(false);
        return;
      }

      const { runId } = (await startRes.json()) as { runId: string };
      setActiveRunId(runId);
      addTerminalLine("system", `► Script iniciado — ID: ${runId}`);

      const evtSource = new EventSource(`/api/playwright/run/${runId}/events`);

      evtSource.onmessage = (e) => {
        const data = JSON.parse(e.data) as { type: string; line?: string; status?: string };
        if (data.type === "line" && data.line) {
          const raw = data.line;
          let type: TerminalLine["type"] = "info";
          if (raw.startsWith("[system]")) type = "system";
          else if (raw.startsWith("[error]")) type = "error";
          else if (raw.startsWith("[stderr]")) type = "warn";
          const text = raw.replace(/^\[(system|stdout|stderr|error)\]\s?/, "");
          addTerminalLine(type, text);
        } else if (data.type === "done") {
          evtSource.close();
          setIsRunning(false);
        }
      };

      evtSource.onerror = () => {
        evtSource.close();
        setIsRunning(false);
      };
    } catch (err) {
      addTerminalLine("error", `Erro: ${err instanceof Error ? err.message : String(err)}`);
      setIsRunning(false);
    }
  }, [isRunning, selectedCompany, activeFile, addTerminalLine]);

  const publishToGithub = useCallback(async () => {
    if (!activeFile) return;
    setPublishing(true);
    setPublishMessage(null);
    try {
      const slug = activeFile.path.replace(/[^a-zA-Z0-9_\-./]/g, "-");
      const response = await fetch("/api/automations/github/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          companySlug: selectedCompany,
          projectId: selectedTestProjectId || null,
          branch: `automation-ide/${slug.replace(/\//g, "-")}-${Date.now()}`,
          files: [{ path: `tests-ide/${slug}`, content: activeFile.content }],
          commitMessage: `[ide] publish ${activeFile.path}`,
          prTitle: `[IDE] Publicar: ${activeFile.path}`,
          prBody: `Arquivo exportado da IDE interna (tests-ide/${slug}).`,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "Falha ao publicar no GitHub.");
      setPublishMessage(`Publicado: ${payload.pullRequestUrl}`);
    } catch (error) {
      setPublishMessage(error instanceof Error ? error.message : "Falha ao publicar no GitHub.");
    } finally {
      setPublishing(false);
    }
  }, [activeFile, selectedCompany, selectedTestProjectId]);

  const openFloatingAssistant = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("assistant:open", {
        detail: {
          source: "playwright-studio",
          agentMode: "playwright",
          panelMode: "side",
          initialMessage: "Ajude a automatizar o projeto Quality Control em produção controlada, com foco em estabilidade e cobertura crítica.",
        },
      }),
    );
  }, []);

  const loadTestProjects = useCallback(async () => {
    if (!selectedCompany) return;
    try {
      const res = await fetch(`/api/test-projects?companySlug=${encodeURIComponent(selectedCompany)}&includeCases=true`);
      if (!res.ok) return;
      const data = (await res.json()) as { projects?: TestProjectOption[] };
      const projects = Array.isArray(data.projects) ? data.projects : [];
      setTestProjects(projects);
      if (!projects.find((item) => item.id === selectedTestProjectId)) {
        const qualityControl = projects.find((item) => /quality\s*control/i.test(item.name) || /quality\s*control/i.test(item.code ?? ""));
        setSelectedTestProjectId(qualityControl?.id ?? projects[0]?.id ?? "");
      }
    } catch {
      setTestProjects([]);
    }
  }, [selectedCompany, selectedTestProjectId]);

  const loadPlans = useCallback(async () => {
    if (!selectedCompany || !selectedTestProject) return;
    try {
      const qs = new URLSearchParams({
        companySlug: selectedCompany,
        applicationId: selectedTestProject.applicationId ?? "",
        source: "manual",
      });
      if (activeProjectId) qs.set("projectId", activeProjectId);
      if (selectedTestProject.code) qs.set("project", selectedTestProject.code);
      const res = await fetch(`/api/test-plans?${qs.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as { plans?: TestPlanOption[] };
      const plans = Array.isArray(data.plans) ? data.plans : [];
      setTestPlans(plans);
      if (selectedPlanId && !plans.find((item) => item.id === selectedPlanId)) {
        setSelectedPlanId("");
      }
    } catch {
      setTestPlans([]);
    }
  }, [selectedCompany, selectedTestProject, activeProjectId, selectedPlanId]);

  const handleCreateCasePlanAndRepository = useCallback(async () => {
    if (!selectedCompany || !selectedTestProject) {
      addTerminalLine("warn", "Selecione empresa e projeto de teste para continuar.");
      setRightTab("config");
      return;
    }
    if (!flowCaseTitle.trim()) {
      addTerminalLine("warn", "Informe o título do caso de teste.");
      setRightTab("config");
      return;
    }

    setFlowBusy(true);
    try {
      addTerminalLine("system", "Criando caso de teste no projeto Quality Control...");
      const caseRes = await fetch("/api/test-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug: selectedCompany,
          projectId: activeProjectId ?? undefined,
          applicationId: selectedTestProject.applicationId ?? undefined,
          testProjectCode: selectedTestProject.code ?? undefined,
          source: "playwright",
          type: "hybrid",
          status: "active",
          priority: "high",
          automationStatus: "planned",
          title: flowCaseTitle.trim(),
          description: flowCaseDescription.trim() || undefined,
          steps: [
            {
              order: 1,
              action: "Executar cenário crítico no ambiente de produção controlada",
              expectedResult: "Fluxo concluído sem falhas críticas e com evidências de execução",
            },
          ],
        }),
      });
      if (!caseRes.ok) {
        const err = (await caseRes.json().catch(() => ({ message: "Falha ao criar caso" }))) as { message?: string };
        addTerminalLine("error", err.message ?? "Falha ao criar caso de teste");
        return;
      }
      const caseData = (await caseRes.json()) as { testCase?: { id?: string } };
      const createdCaseId = caseData.testCase?.id;
      if (!createdCaseId) {
        addTerminalLine("error", "Caso criado sem ID retornado.");
        return;
      }
      addTerminalLine("success", `Caso criado: ${createdCaseId}`);

      let targetPlanId = selectedPlanId;
      if (!targetPlanId) {
        addTerminalLine("system", "Criando plano de teste e vinculando caso...");
        const planRes = await fetch("/api/test-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companySlug: selectedCompany,
            applicationId: selectedTestProject.applicationId,
            projectId: activeProjectId ?? undefined,
            projectCode: selectedTestProject.code ?? undefined,
            source: "manual",
            title: `Plano Playwright ${selectedTestProject.name} — ${new Date().toLocaleDateString("pt-BR")}`,
            description: "Plano criado automaticamente via Playwright Studio para execução em produção controlada.",
            testCaseIds: [createdCaseId],
          }),
        });
        if (!planRes.ok) {
          const err = (await planRes.json().catch(() => ({ error: "Falha ao criar plano" }))) as { error?: string };
          addTerminalLine("error", err.error ?? "Falha ao criar plano");
          return;
        }
        const planData = (await planRes.json()) as { plan?: { id?: string } };
        targetPlanId = planData.plan?.id ?? "";
        setSelectedPlanId(targetPlanId);
        addTerminalLine("success", `Plano criado: ${targetPlanId}`);
      } else {
        addTerminalLine("system", "Vinculando caso ao plano selecionado...");
        const linkRes = await fetch(`/api/test-plans/${encodeURIComponent(targetPlanId)}/test-cases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companySlug: selectedCompany,
            testCaseIds: [createdCaseId],
          }),
        });
        if (!linkRes.ok) {
          const err = (await linkRes.json().catch(() => ({ message: "Falha ao vincular caso ao plano" }))) as { message?: string };
          addTerminalLine("error", err.message ?? "Falha ao vincular caso ao plano");
          return;
        }
        addTerminalLine("success", `Caso vinculado ao plano: ${targetPlanId}`);
      }

      const currentSpecFile = specFiles[0]?.path ?? "tests/generated.spec.ts";
      addTerminalLine("system", "Salvando vínculo de automação com repositório...");
      const repoRes = await fetch(`/api/test-cases/${encodeURIComponent(createdCaseId)}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository: flowRepository.trim() || undefined,
          branch: flowBranch.trim() || "main",
          specFile: currentSpecFile,
          testDescribe: flowCaseTitle.trim(),
          testTitle: flowCaseTitle.trim(),
          playwrightProject: "quality-control",
          environment: "production_controlled",
          command: "npx playwright test",
          status: "active",
        }),
      });
      if (!repoRes.ok) {
        const err = (await repoRes.json().catch(() => ({ message: "Falha ao salvar envio ao repositório" }))) as { message?: string };
        addTerminalLine("warn", err.message ?? "Falha ao salvar envio ao repositório");
      } else {
        addTerminalLine("success", `Envio ao repositório registrado (${flowRepository || "repositório padrão"}).`);
      }

      await loadPlans();
    } finally {
      setFlowBusy(false);
    }
  }, [
    selectedCompany,
    selectedTestProject,
    flowCaseTitle,
    flowCaseDescription,
    selectedPlanId,
    flowRepository,
    flowBranch,
    activeProjectId,
    specFiles,
    addTerminalLine,
    setRightTab,
    loadPlans,
  ]);

  useEffect(() => {
    if (selectedCompany) void loadTestProjects();
  }, [selectedCompany, loadTestProjects]);

  useEffect(() => {
    if (selectedCompany && selectedTestProject) void loadPlans();
  }, [selectedCompany, selectedTestProject, loadPlans]);

  useEffect(() => {
    if (!selectedRepositoryCase) return;
    if (flowCaseTitle === "Caso E2E Playwright - Quality Control") {
      setFlowCaseTitle(selectedRepositoryCase.title);
    }
    if (flowCaseDescription === "Validar fluxo crítico do sistema em produção controlada.") {
      setFlowCaseDescription(selectedRepositoryCase.description ?? flowCaseDescription);
    }
  }, [selectedRepositoryCase, flowCaseTitle, flowCaseDescription]);

  const handleCloseTab = useCallback(
    (fileId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setOpenFileIds((prev) => {
        const next = prev.filter((id) => id !== fileId);
        if (activeFileId === fileId) {
          setActiveFileId(next[next.length - 1] ?? null);
        }
        return next;
      });
    },
    [activeFileId],
  );

  const handleContextMenu = useCallback(
    (fileId: string, e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({ fileId, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleRename = useCallback(
    (fileId: string) => {
      const file = getAllFiles(tree).find((f) => f.id === fileId);
      if (!file) return;
      setRenaming(fileId);
      setRenameValue(file.name);
      setContextMenu(null);
    },
    [tree],
  );

  const handleRenameSubmit = useCallback(
    (fileId: string) => {
      if (!renameValue.trim()) {
        setRenaming(null);
        return;
      }
      const oldFile = getAllFiles(tree).find((f) => f.id === fileId);
      setTree((prev) =>
        updateFileInTree(prev, fileId, (f) => ({
          ...f,
          name: renameValue.trim(),
          path: f.path.replace(f.name, renameValue.trim()),
        })),
      );
      setRenaming(null);
      if (oldFile && selectedCompany) {
        const newPath = oldFile.path.replace(oldFile.name, renameValue.trim());
        void fetch("/api/automations/scripts", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companySlug: selectedCompany,
            path: oldFile.path,
          }),
        }).then(() =>
          fetch("/api/automations/scripts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companySlug: selectedCompany,
              path: newPath,
              content: oldFile.content,
              status: oldFile.status,
            }),
          }),
        );
      }
    },
    [renameValue, tree, selectedCompany],
  );

  const handleDeleteFile = useCallback(
    (fileId: string) => {
      const file = getAllFiles(tree).find((f) => f.id === fileId);
      setTree((prev) => deleteFileInTree(prev, fileId));
      setOpenFileIds((prev) => prev.filter((id) => id !== fileId));
      if (activeFileId === fileId) setActiveFileId(null);
      setContextMenu(null);
      if (file && selectedCompany) {
        void fetch("/api/automations/scripts", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companySlug: selectedCompany,
            path: file.path,
          }),
        });
      }
    },
    [activeFileId, tree, selectedCompany],
  );

  const handleAddFile = useCallback(() => {
    if (!addingName.trim()) {
      setAddingIn(null);
      return;
    }
    const isSpec = addingName.includes(".spec.");
    const isPage = addingIn?.folderId
      ? tree.folders.find((f) => f.id === addingIn.folderId)?.name === "pages"
      : false;
    const content = isSpec
      ? NEW_SPEC_TEMPLATE(
          addingName.replace(".spec.ts", "").replace(".spec.js", ""),
        )
      : isPage
        ? NEW_PAGE_TEMPLATE(addingName.replace(".ts", "").replace(".js", ""))
        : `// ${addingName}\n`;
    const newFile: ProjectFile = {
      id: uid(),
      name: addingName.trim(),
      path: addingIn?.folderId
        ? `${tree.folders.find((f) => f.id === addingIn.folderId)?.name ?? ""}/${addingName.trim()}`
        : addingName.trim(),
      content,
      language: addingName.endsWith(".json") ? "json" : "typescript",
      status: "not_started",
      updatedAt: now(),
    };
    setTree((prev) => {
      if (!addingIn?.folderId) {
        return {
          ...prev,
          folders: [
            ...prev.folders,
            { id: uid(), name: newFile.name, expanded: true, children: [newFile] },
          ],
        };
      }
      return {
        ...prev,
        folders: prev.folders.map((folder) =>
          folder.id === addingIn.folderId
            ? { ...folder, children: [...folder.children, newFile] }
            : folder,
        ),
      };
    });
    setActiveFileId(newFile.id);
    setAddingIn(null);
    setAddingName("");
  }, [addingName, addingIn, tree.folders]);

  // â”€â”€ Render: File Tree Node â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const DEPTH_PL = ["pl-2", "pl-5", "pl-8", "pl-11", "pl-14"] as const;
  function depthPl(depth: number) {
    return DEPTH_PL[Math.min(depth, DEPTH_PL.length - 1)];
  }

  function renderFile(file: ProjectFile, depth = 1) {
    const isActive = file.id === activeFileId;
    const isRenaming = renaming === file.id;

    if (isRenaming) {
      return (
        <div key={file.id} className={`px-2 py-1 ${depthPl(depth)}`}>
          <input
            autoFocus
            aria-label="Renomear arquivo"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => handleRenameSubmit(file.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit(file.id);
              if (e.key === "Escape") setRenaming(null);
            }}
            className="w-full rounded bg-slate-100 px-1 text-slate-900 outline-none ring-1 ring-blue-500 dark:bg-zinc-700 dark:text-zinc-100"
          />
        </div>
      );
    }

    return (
      <div key={file.id}>
        <button
          type="button"
          onContextMenu={(e) => handleContextMenu(file.id, e)}
          onClick={() => setActiveFileId(file.id)}
          className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1 ${depthPl(depth)} text-left text-[13px] transition-colors ${
            isActive
              ? "bg-[#ef0001]/10 text-[#ef0001]"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          }`}
        >
          <FiFile className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="flex-1 truncate">{file.name}</span>
          <StatusBadge status={file.status} />
        </button>
      </div>
    );
  }

  function renderFolder(folder: ProjectFolder, depth = 0) {
    const isAdding =
      addingIn?.folderId === folder.id && addingIn.kind === "file";
    return (
      <div key={folder.id}>
        <div
          className={`group flex w-full items-center gap-2 rounded-lg py-1.5 ${depthPl(depth)} text-[13px] font-medium text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/5`}
        >
          <button
            type="button"
            onClick={() => setTree((prev) => toggleFolderInTree(prev, folder.id))}
            className="flex flex-1 items-center gap-2 text-left"
          >
            {folder.expanded ? (
              <FiChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <FiChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
            <FiFolder className="h-3.5 w-3.5 shrink-0 text-blue-500 dark:text-blue-400" />
            <span className="flex-1 truncate">{folder.name}</span>
          </button>
          <button
            type="button"
            title="Novo arquivo"
            aria-label="Novo arquivo na pasta"
            onClick={() => {
              setAddingIn({ folderId: folder.id, kind: "file" });
              setAddingName("");
            }}
            className="mr-1 hidden h-5 w-5 items-center justify-center rounded opacity-60 hover:opacity-100 focus:outline-none group-hover:flex"
          >
            <FiFilePlus className="h-3.5 w-3.5" />
          </button>
        </div>
        {folder.expanded && (
          <div>
            {folder.children.map((child) =>
              isFile(child)
                ? renderFile(child, depth + 1)
                : renderFolder(child as ProjectFolder, depth + 1),
            )}
            {isAdding && (
              <div className={`px-2 py-1 ${depthPl(depth + 1)}`}>
                <input
                  autoFocus
                  aria-label="Nome do novo arquivo"
                  value={addingName}
                  onChange={(e) => setAddingName(e.target.value)}
                  onBlur={handleAddFile}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddFile();
                    if (e.key === "Escape") {
                      setAddingIn(null);
                      setAddingName("");
                    }
                  }}
                  placeholder="arquivo.spec.ts"
                  className="w-full rounded bg-slate-100 px-2 py-0.5 text-[13px] text-slate-900 outline-none ring-1 ring-blue-500 dark:bg-zinc-700 dark:text-zinc-100"
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // â”€â”€ Render: Config Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function renderConfig() {
    return (
      <div className="space-y-4 overflow-auto p-4 text-[13px]">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
            Prontidão
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded bg-white px-2 py-1 dark:bg-zinc-900">
              <span className="text-slate-500 dark:text-zinc-500">Specs</span>
              <p className="font-semibold text-slate-700 dark:text-zinc-200">{specFiles.length}</p>
            </div>
            <div className="rounded bg-white px-2 py-1 dark:bg-zinc-900">
              <span className="text-slate-500 dark:text-zinc-500">Publicados</span>
              <p className="font-semibold text-slate-700 dark:text-zinc-200">{publishedSpecCount}</p>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() =>
                setConfig((prev) => ({ ...prev, headless: false, workers: 1, retries: 0, screenshotOn: "only-on-failure", videoOn: "retain-on-failure" }))
              }
              className="rounded bg-white px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
            >
              Preset: Debug
            </button>
            <button
              type="button"
              onClick={() =>
                setConfig((prev) => ({ ...prev, headless: true, workers: Math.max(2, prev.workers), retries: Math.max(1, prev.retries), screenshotOn: "only-on-failure", videoOn: "retain-on-failure" }))
              }
              className="rounded bg-white px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
            >
              Preset: CI
            </button>
            <button
              type="button"
              onClick={() =>
                setConfig((prev) => ({ ...prev, headless: false, workers: 1, retries: Math.max(0, prev.retries), screenshotOn: "on", videoOn: "on" }))
              }
              className="rounded bg-white px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
            >
              Preset: Produção (abre navegador)
            </button>
            <button
              type="button"
              onClick={openFloatingAssistant}
              className="rounded bg-white px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
              title="Abrir assistente flutuante para automação"
            >
              Assistente flutuante
            </button>
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-white px-2.5 py-2 text-[11px] text-slate-600 ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700">
            <input
              type="checkbox"
              checked={openBrowserOnRun}
              onChange={(e) => {
                const checked = e.target.checked;
                setOpenBrowserOnRun(checked);
                if (checked) {
                  setConfig((prev) => ({
                    ...prev,
                    browsers: [prev.browser],
                    headless: false,
                    workers: 1,
                  }));
                }
              }}
              className="mt-0.5 h-4 w-4 rounded accent-[#ef0001]"
            />
            <span>
              <span className="block font-semibold text-slate-700 dark:text-zinc-200">Modo IDE visual</span>
              Abre uma aba de previa e roda headed com 1 worker para voce acompanhar a UI acontecendo.
            </span>
          </label>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
            Fluxo Produção Quality Control
          </p>
          <div className="mt-2 space-y-2">
            <label className="block">
              <span className="text-slate-600 dark:text-zinc-400">Projeto de teste</span>
              <select
                aria-label="Projeto de teste"
                value={selectedTestProjectId}
                onChange={(e) => setSelectedTestProjectId(e.target.value)}
                className="mt-1 w-full rounded-lg bg-white px-2 py-2 text-[12px] text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-[#ef0001] dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
              >
                <option value="">Selecionar projeto...</option>
                {testProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {(project.code ? `${project.code} - ` : "") + project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-slate-600 dark:text-zinc-400">Plano vinculado na execução</span>
              <select
                aria-label="Plano de teste"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="mt-1 w-full rounded-lg bg-white px-2 py-2 text-[12px] text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-[#ef0001] dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
              >
                <option value="">Criar novo plano automaticamente</option>
                {testPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-slate-600 dark:text-zinc-400">Título do caso</span>
              <input
                value={flowCaseTitle}
                onChange={(e) => setFlowCaseTitle(e.target.value)}
                className="mt-1 w-full rounded-lg bg-white px-2 py-2 text-[12px] text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-[#ef0001] dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
              />
            </label>
            <label className="block">
              <span className="text-slate-600 dark:text-zinc-400">Descrição do caso</span>
              <textarea
                value={flowCaseDescription}
                onChange={(e) => setFlowCaseDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full resize-none rounded-lg bg-white px-2 py-2 text-[12px] text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-[#ef0001] dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-slate-600 dark:text-zinc-400">Repositório</span>
                <input
                  value={flowRepository}
                  onChange={(e) => setFlowRepository(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white px-2 py-2 text-[12px] text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-[#ef0001] dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
                />
              </label>
              <label className="block">
                <span className="text-slate-600 dark:text-zinc-400">Branch</span>
                <input
                  value={flowBranch}
                  onChange={(e) => setFlowBranch(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white px-2 py-2 text-[12px] text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-[#ef0001] dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void handleCreateCasePlanAndRepository()}
              disabled={flowBusy || !selectedCompany || !selectedTestProject}
              className="w-full rounded-lg bg-[#ef0001] py-2 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
              title="Criar caso, vincular a plano e registrar envio ao repositório"
            >
              {flowBusy ? "Processando..." : "Criar caso + vincular plano + enviar ao repositório"}
            </button>
          </div>
        </div>
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
            Configuração de Execução
          </p>
          <div className="space-y-3">
            <label className="block">
              <span className="text-slate-600 dark:text-zinc-400">Base URL</span>
              <input
                value={config.baseURL}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, baseURL: e.target.value }))
                }
                className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
              />
            </label>
            <label className="block">
              <span className="text-slate-600 dark:text-zinc-400">Browser</span>
              <select
                value={config.browser}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    browser: e.target.value as PlaywrightConfig["browser"],
                    browsers: [e.target.value as PlaywrightConfig["browser"]],
                  }))
                }
                className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
              >
                <option value="chromium">Chromium</option>
                <option value="firefox">Firefox</option>
                <option value="webkit">WebKit (Safari)</option>
              </select>
            </label>
            <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-zinc-900/60 dark:ring-zinc-700">
              <p className="mb-2 text-[11px] font-semibold text-slate-600 dark:text-zinc-300">Matriz de Navegadores (mesma run)</p>
              <div className="flex flex-wrap gap-3 text-[12px] text-slate-700 dark:text-zinc-300">
                {(["chromium", "firefox", "webkit"] as const).map((browser) => (
                  <label key={browser} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.browsers.includes(browser)}
                      onChange={(e) => {
                        setConfig((prev) => {
                          const next = e.target.checked
                            ? Array.from(new Set([...prev.browsers, browser]))
                            : prev.browsers.filter((item) => item !== browser);
                          return {
                            ...prev,
                            browsers: next,
                            browser: (next[0] ?? prev.browser) as PlaywrightConfig["browser"],
                          };
                        });
                      }}
                      className="h-4 w-4 rounded accent-[#ef0001]"
                    />
                    <span>{browser}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-500 dark:text-zinc-500">
                Dica: selecione os 3 para executar em lote como Playwright original.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-slate-600 dark:text-zinc-400">Timeout (ms)</span>
                <input
                  type="number"
                  value={config.timeout}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      timeout: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
                />
              </label>
              <label className="block">
                <span className="text-slate-600 dark:text-zinc-400">Workers</span>
                <input
                  type="number"
                  value={config.workers}
                  min={1}
                  max={8}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      workers: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-slate-600 dark:text-zinc-400">Retries</span>
                <input
                  type="number"
                  value={config.retries}
                  min={0}
                  max={5}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      retries: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  checked={config.headless}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      headless: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded accent-[#ef0001]"
                />
                <span className="text-slate-600 dark:text-zinc-400">Headless</span>
              </label>
            </div>
            <label className="block">
              <span className="text-slate-600 dark:text-zinc-400">Screenshot</span>
              <select
                value={config.screenshotOn}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    screenshotOn: e.target.value as PlaywrightConfig["screenshotOn"],
                  }))
                }
                className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
              >
                <option value="off">Off</option>
                <option value="on">On</option>
                <option value="only-on-failure">Só na falha</option>
              </select>
            </label>
            <label className="block">
              <span className="text-slate-600 dark:text-zinc-400">Vídeo</span>
              <select
                value={config.videoOn}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    videoOn: e.target.value as PlaywrightConfig["videoOn"],
                  }))
                }
                className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
              >
                <option value="off">Off</option>
                <option value="on">On</option>
                <option value="retain-on-failure">Reter na falha</option>
              </select>
            </label>
          </div>
        </div>
        {companies.length > 1 && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
              Empresa alvo
            </p>
            <select
              aria-label="Empresa alvo"
              value={selectedCompany ?? ""}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full rounded-lg bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
            >
              {companies.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            {griauleCompany && selectedCompany !== griauleCompany.slug && (
              <button
                type="button"
                onClick={() => setSelectedCompany(griauleCompany.slug)}
                className="mt-2 rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
                title="Selecionar empresa Griaule"
              >
                Rodar na Griaule
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // â”€â”€ Render: Terminal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function renderTerminal() {
    return (
      <div className="flex h-full flex-col bg-[#1e1e1e]">
        <div className="flex items-center justify-end gap-2 border-b border-white/10 px-3 py-2 text-[11px]">
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(terminal.map((line) => `[${line.ts}] ${line.text}`).join("\n"))}
            className="rounded bg-white/10 px-2 py-1 text-zinc-300 hover:bg-white/20"
          >
            Copiar log
          </button>
          <button
            type="button"
            onClick={() => setTerminal([])}
            className="rounded bg-white/10 px-2 py-1 text-zinc-300 hover:bg-white/20"
          >
            Limpar
          </button>
        </div>
        <div
          ref={terminalRef}
          className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[12px]"
        >
        {terminal.length === 0 && (
          <p className="text-zinc-600">
            Terminal vazio. Execute um teste para ver os logs aqui.
          </p>
        )}
        {terminal.map((line) => (
          <div key={line.id} className={`flex gap-2 ${TERM_COLORS[line.type]}`}>
            <span className="shrink-0 opacity-40">{line.ts}</span>
            <span className="whitespace-pre-wrap break-all">{line.text}</span>
          </div>
        ))}
        {isRunning && (
          <div className="flex items-center gap-2 text-zinc-500">
            <span className="animate-pulse">â–Š</span>
          </div>
        )}
        </div>
      </div>
    );
  }

  // â”€â”€ Render: Runs history â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const RUN_STATUS_COLORS: Record<string, string> = {
    queued:  "text-zinc-400",
    running: "text-blue-400",
    passed:  "text-emerald-400",
    failed:  "text-red-400",
    error:   "text-red-500",
  };

  const RUN_STATUS_LABELS: Record<string, string> = {
    queued:  "Na fila",
    running: "Executando",
    passed:  "Passou",
    failed:  "Falhou",
    error:   "Erro",
  };

  function renderRuns() {
    const normalizedQuery = runSearchQuery.trim().toLowerCase();
    const filteredRuns = runHistory.filter((run) => {
      if (runStatusFilter !== "all" && run.status !== runStatusFilter) return false;
      if (!normalizedQuery) return true;

      const titleMatch = (run.title ?? "").toLowerCase().includes(normalizedQuery);
      if (titleMatch) return true;

      const details = runDetails[run.id] ?? [];
      return details.some((result) =>
        [result.title, result.spec_file, result.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      );
    });

    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-zinc-800">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-zinc-500">
            Histórico
          </span>
          <button
            type="button"
            title="Atualizar"
            onClick={() => selectedCompany && void loadRuns(selectedCompany)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <FiRefreshCw className={`h-3.5 w-3.5 ${runsLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 border-b border-slate-200 px-3 py-2 dark:border-zinc-800">
          <input
            aria-label="Buscar execução"
            placeholder="Buscar por execução ou teste"
            value={runSearchQuery}
            onChange={(e) => setRunSearchQuery(e.target.value)}
            className="h-8 rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none ring-[#ef0001] focus:ring-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          />
          <select
            aria-label="Filtrar status da execução"
            value={runStatusFilter}
            onChange={(e) =>
              setRunStatusFilter(
                e.target.value as "all" | "queued" | "running" | "passed" | "failed" | "error",
              )
            }
            className="h-8 rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none ring-[#ef0001] focus:ring-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="all">Todos os status</option>
            <option value="queued">Na fila</option>
            <option value="running">Executando</option>
            <option value="passed">Passou</option>
            <option value="failed">Falhou</option>
            <option value="error">Erro</option>
          </select>
          <select
            aria-label="Comparar com execução"
            value={compareToRunId}
            onChange={(e) => {
              setCompareToRunId(e.target.value);
              if (activeRunId) {
                setRunComparisons((prev) => {
                  const next = { ...prev };
                  delete next[activeRunId];
                  return next;
                });
              }
            }}
            className="h-8 rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none ring-[#ef0001] focus:ring-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="">Sem comparação</option>
            {runHistory.map((run) => (
              <option key={run.id} value={run.id}>
                {new Date(run.created_at).toLocaleString("pt-BR")} - {run.title}
              </option>
            ))}
          </select>
        </div>
        {activeRunId && runComparisons[activeRunId] && (
          <div className="border-b border-slate-200 px-3 py-2 dark:border-zinc-800">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] dark:border-zinc-700 dark:bg-zinc-900">
              <p className="mb-1 font-semibold text-slate-600 dark:text-zinc-300">Impacto da regressão</p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded bg-red-50 px-2 py-0.5 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {runComparisons[activeRunId]?.regressions ?? 0} regressões
                </span>
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {runComparisons[activeRunId]?.improvements ?? 0} melhorias
                </span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {runComparisons[activeRunId]?.unchanged ?? 0} iguais
                </span>
                <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {runComparisons[activeRunId]?.newItems ?? 0} novos
                </span>
              </div>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-auto p-2 text-[12px]">
          {runsLoading && (
            <p className="p-3 text-zinc-500 dark:text-zinc-600">Carregando…</p>
          )}
          {!runsLoading && runHistory.length === 0 && (
            <p className="p-3 text-zinc-500 dark:text-zinc-600">
              Nenhuma execução registrada.
            </p>
          )}
          {!runsLoading && runHistory.length > 0 && filteredRuns.length === 0 && (
            <p className="p-3 text-zinc-500 dark:text-zinc-600">
              Nenhuma execução encontrada para os filtros aplicados.
            </p>
          )}
          {filteredRuns.map((run) => (
            <div
              key={run.id}
              onClick={() => setActiveRunId(run.id === activeRunId ? null : run.id)}
              className={`mb-1.5 cursor-pointer rounded-lg border px-3 py-2 transition-colors ${
                activeRunId === run.id
                  ? "border-[#ef0001] bg-red-50 dark:border-[#ef0001] dark:bg-zinc-800"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-slate-700 dark:text-zinc-300">
                  {run.title || "Execução"}
                </span>
                <span className={`shrink-0 font-semibold ${RUN_STATUS_COLORS[run.status] ?? "text-zinc-400"}`}>
                  {RUN_STATUS_LABELS[run.status] ?? run.status}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400 dark:text-zinc-600">
                {run.project_id && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">Projeto: {run.project_id}</span>
                )}
                <span>{run.browser}</span>
                <span>{new Date(run.created_at).toLocaleString("pt-BR")}</span>
                {run.finished_at && run.started_at && (
                  <span>
                    {(
                      (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) /
                      1000
                    ).toFixed(1)}s
                  </span>
                )}
              </div>
              {activeRunId === run.id && (
                <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-[10px] dark:border-zinc-700 dark:bg-zinc-950">
                  {(() => {
                    const results = runDetails[run.id] ?? [];
                    const comparison = runComparisons[run.id] ?? null;
                    if (!results.length) {
                      return <p className="text-slate-500 dark:text-zinc-500">Reporter: sem resultados detalhados ainda.</p>;
                    }
                    const passed = results.filter((r) => r.status === "passed").length;
                    const failed = results.filter((r) => r.status === "failed").length;
                    const flaky = results.filter((r) => r.status === "flaky").length;
                    const skipped = results.filter((r) => r.status === "skipped").length;
                    return (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-600 dark:text-zinc-300">
                          <span>Reporter:</span>
                          <span className="text-emerald-600 dark:text-emerald-400">{passed} passed</span>
                          <span className="text-red-600 dark:text-red-400">{failed} failed</span>
                          <span className="text-amber-600 dark:text-amber-400">{flaky} flaky</span>
                          <span className="text-zinc-500 dark:text-zinc-400">{skipped} skipped</span>
                        </div>
                        <div className="max-h-28 overflow-auto space-y-1">
                          {comparison && (
                            <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                              <span className="text-slate-500 dark:text-zinc-400">Comparação:</span>
                              <span className="text-red-600 dark:text-red-400">{comparison.regressions} regressões</span>
                              <span className="text-emerald-600 dark:text-emerald-400">{comparison.improvements} melhorias</span>
                              <span className="text-zinc-500 dark:text-zinc-400">{comparison.unchanged} iguais</span>
                            </div>
                          )}
                          {results.slice(-12).map((result) => (
                            <div
                              key={result.id}
                              className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-[10px] ${(() => {
                                const key = `${result.spec_file}::${result.title}`;
                                const trend = comparison?.byKey?.[key];
                                if (trend === "regression") return "bg-red-50 dark:bg-red-900/20";
                                if (trend === "improvement") return "bg-emerald-50 dark:bg-emerald-900/20";
                                return "bg-white dark:bg-zinc-900";
                              })()}`}
                            >
                              <span className="truncate text-slate-700 dark:text-zinc-300" title={result.title}>{result.title}</span>
                              <span className={`shrink-0 font-semibold ${RUN_STATUS_COLORS[result.status] ?? "text-zinc-400"}`}>{result.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // â”€â”€ Render: Agents panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function callAgentPlanner() {
    if (!selectedCompany || !plannerInput.trim()) return;
    setAgentLoading(true);
    setAgentResult(null);
    try {
      const res = await fetch("/api/playwright/agents/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug: selectedCompany,
          testCaseSummary: plannerInput,
          existingSpec: activeFile?.content,
          baseURL: config.baseURL,
        }),
      });
      const data = (await res.json()) as { plan?: string; error?: string };
      setAgentResult(data.plan ?? data.error ?? "Sem resultado");
    } catch (err) {
      setAgentResult(err instanceof Error ? err.message : String(err));
    } finally {
      setAgentLoading(false);
    }
  }

  async function callAgentGenerator() {
    if (!selectedCompany || !generatorInput.trim()) return;
    setAgentLoading(true);
    setAgentResult(null);
    try {
      const res = await fetch("/api/playwright/agents/generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug: selectedCompany,
          testCaseSummary: generatorInput,
          targetType: generatorTargetType,
          repositoryCase: selectedRepositoryCase ?? undefined,
          baseURL: config.baseURL,
          browser: config.browser,
          targetFile: generatorTargetFile,
        }),
      });
      const data = (await res.json()) as { code?: string; error?: string };
      if (data.code) {
        // Inject generated code as a new file in the tree
        const newFile: ProjectFile = {
          id: uid(),
          name: generatorTargetFile.split("/").pop() ?? "generated.spec.ts",
          path: generatorTargetFile,
          content: data.code,
          language: generatorTargetFile.endsWith(".json") ? "json" : "typescript",
          status: "draft",
          updatedAt: now(),
        };
        setTree((prev) => ({
          ...prev,
          folders: prev.folders.map((f) =>
            f.name === "tests"
              ? { ...f, children: [...f.children, newFile] }
              : f,
          ),
        }));
        setActiveFileId(newFile.id);
        setAgentResult(`âœ“ Arquivo gerado: ${generatorTargetFile}`);
        // Persist to DB
        if (selectedCompany) {
          void fetch("/api/automations/scripts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companySlug: selectedCompany, path: generatorTargetFile, content: data.code, status: "draft" }),
          });
        }
      } else {
        setAgentResult(data.error ?? "Erro ao gerar");
      }
    } catch (err) {
      setAgentResult(err instanceof Error ? err.message : String(err));
    } finally {
      setAgentLoading(false);
    }
  }

  async function callAgentHealer() {
    if (!selectedCompany || !activeFile || !healerError.trim()) return;
    setAgentLoading(true);
    setAgentResult(null);
    try {
      const res = await fetch("/api/playwright/agents/healer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug: selectedCompany,
          specContent: activeFile.content,
          errorOutput: healerError,
        }),
      });
      const data = (await res.json()) as { fixedCode?: string; diff?: string; error?: string };
      if (data.fixedCode && activeFileId) {
        setTree((prev) => updateFileInTree(prev, activeFileId, (f) => ({ ...f, content: data.fixedCode!, updatedAt: now() })));
        setAgentResult(`âœ“ Arquivo curado. Diff:\n${data.diff ?? "(sem diff)"}`);
        if (selectedCompany && activeFile) {
          void fetch("/api/automations/scripts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companySlug: selectedCompany, path: activeFile.path, content: data.fixedCode, status: activeFile.status }),
          });
        }
      } else {
        setAgentResult(data.error ?? "Erro ao curar");
      }
    } catch (err) {
      setAgentResult(err instanceof Error ? err.message : String(err));
    } finally {
      setAgentLoading(false);
    }
  }

  function renderAgents() {
    return (
      <div className="flex h-full flex-col text-[12px]">
        {/* Agent sub-tabs */}
        <div className="flex border-b border-slate-200 dark:border-zinc-800">
          {(["planner", "generator", "healer"] as const).map((tab) => {
            const labels = { planner: "Planejador", generator: "Gerador", healer: "Curador" };
            const icons = { planner: <FiList className="h-3 w-3" />, generator: <FiZap className="h-3 w-3" />, healer: <FiCpu className="h-3 w-3" /> };
            return (
              <button
                key={tab}
                type="button"
                onClick={() => { setAgentTab(tab); setAgentResult(null); }}
                className={`flex flex-1 items-center justify-center gap-1 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  agentTab === tab
                    ? "border-b-2 border-[#ef0001] text-[#ef0001]"
                    : "text-slate-400 hover:text-slate-600 dark:text-zinc-600 dark:hover:text-zinc-400"
                }`}
              >
                {icons[tab]} {labels[tab]}
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-auto p-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
              Caso do Repositório de Testes
            </p>
            <div className="flex gap-2">
              <label htmlFor="repository-case-select" className="sr-only">
                Selecionar caso do repositório de testes
              </label>
              <select
                id="repository-case-select"
                aria-label="Selecionar caso do repositório de testes"
                title="Selecionar caso do repositório de testes"
                value={selectedRepositoryCaseId}
                onChange={(e) => setSelectedRepositoryCaseId(e.target.value)}
                className="min-w-0 flex-1 rounded bg-white px-2 py-1 text-[11px] text-slate-700 ring-1 ring-slate-200 outline-none focus:ring-blue-500 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
              >
                <option value="">Selecionar caso...</option>
                {repositoryCases.slice(0, 200).map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.key ? `${tc.key} - ` : ""}{tc.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!selectedRepositoryCase) return;
                  const payload = `${selectedRepositoryCase.key ? `${selectedRepositoryCase.key} - ` : ""}${selectedRepositoryCase.title}\n${selectedRepositoryCase.description ?? ""}`.trim();
                  setPlannerInput(payload);
                  setGeneratorInput(payload);
                }}
                disabled={!selectedRepositoryCase}
                className="rounded bg-white px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
              >
                Usar
              </button>
            </div>
          </div>

          {agentTab === "planner" && (
            <>
              <p className="text-[11px] text-slate-500 dark:text-zinc-500">
                Descreva o caso de teste e o agente gera um plano detalhado de automação.
              </p>
              <textarea
                value={plannerInput}
                onChange={(e) => setPlannerInput(e.target.value)}
                rows={4}
                placeholder="Ex: Testar login com email inválido deve exibir mensagem de erro..."
                className="w-full resize-none rounded-lg bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
              />
              <button
                type="button"
                onClick={() => void callAgentPlanner()}
                disabled={agentLoading || !plannerInput.trim()}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#ef0001] py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {agentLoading ? <FiRefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FiList className="h-3.5 w-3.5" />}
                Gerar plano
              </button>
            </>
          )}

          {agentTab === "generator" && (
            <>
              <p className="text-[11px] text-slate-500 dark:text-zinc-500">
                Descreva o teste e o agente gera o código Playwright completo.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGeneratorTargetType("playwright");
                    if (!generatorTargetFile.endsWith(".spec.ts")) {
                      setGeneratorTargetFile("tests/generated.spec.ts");
                    }
                  }}
                  className={`rounded px-2 py-1 text-[11px] font-semibold ${generatorTargetType === "playwright" ? "bg-[#ef0001] text-white" : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
                >
                  E2E Playwright
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGeneratorTargetType("api");
                    if (!generatorTargetFile.endsWith(".json")) {
                      setGeneratorTargetFile("api-flows/generated.flow.json");
                    }
                  }}
                  className={`rounded px-2 py-1 text-[11px] font-semibold ${generatorTargetType === "api" ? "bg-[#ef0001] text-white" : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
                >
                  Fluxo API
                </button>
              </div>
              <textarea
                value={generatorInput}
                onChange={(e) => setGeneratorInput(e.target.value)}
                rows={3}
                placeholder="Ex: Login com credenciais válidas deve redirecionar para o dashboard..."
                className="w-full resize-none rounded-lg bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
              />
              <input
                value={generatorTargetFile}
                onChange={(e) => setGeneratorTargetFile(e.target.value)}
                placeholder="tests/generated.spec.ts"
                className="w-full rounded-lg bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
              />
              <button
                type="button"
                onClick={() => void callAgentGenerator()}
                disabled={agentLoading || !generatorInput.trim()}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#ef0001] py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {agentLoading ? <FiRefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FiZap className="h-3.5 w-3.5" />}
                {generatorTargetType === "api" ? "Gerar fluxo API" : "Gerar código E2E"}
              </button>
            </>
          )}

          {agentTab === "healer" && (
            <>
              <p className="text-[11px] text-slate-500 dark:text-zinc-500">
                Cole o erro do arquivo ativo e o agente corrige o spec automaticamente.
              </p>
              {!activeFile && (
                <p className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  Abra um arquivo para curar.
                </p>
              )}
              <textarea
                value={healerError}
                onChange={(e) => setHealerError(e.target.value)}
                rows={5}
                placeholder="Cole aqui o erro ou stack trace do Playwright..."
                className="w-full resize-none rounded-lg bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
              />
              <button
                type="button"
                onClick={() => void callAgentHealer()}
                disabled={agentLoading || !healerError.trim() || !activeFile}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#ef0001] py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {agentLoading ? <FiRefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FiCpu className="h-3.5 w-3.5" />}
                Curar spec
              </button>
            </>
          )}

          {/* Result box */}
          {agentResult && (
            <div className="mt-2 max-h-64 overflow-auto rounded-lg bg-zinc-900 p-3 text-[11px] font-mono text-zinc-300 ring-1 ring-zinc-700 whitespace-pre-wrap">
              {agentResult}
            </div>
          )}
        </div>
      </div>
    );
  }

  // â”€â”€ Main render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 overflow-hidden bg-[#f3f6fb] text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">
      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            ref={ctxMenuRef}
            className="fixed z-50 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-zinc-700 dark:bg-zinc-800"
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              onClick={() => handleRename(contextMenu.fileId)}
            >
              <FiEdit2 className="h-3.5 w-3.5" /> Renomear
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              onClick={() => {
                const file = getAllFiles(tree).find(
                  (f) => f.id === contextMenu.fileId,
                );
                if (file) navigator.clipboard.writeText(file.content);
                setContextMenu(null);
              }}
            >
              <FiCopy className="h-3.5 w-3.5" /> Copiar conteúdo
            </button>
            <div className="my-1 border-t border-slate-200 dark:border-zinc-700" />
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2 text-[13px] text-red-500 hover:bg-slate-100 dark:text-red-400 dark:hover:bg-zinc-700"
              onClick={() => handleDeleteFile(contextMenu.fileId)}
            >
              <FiTrash2 className="h-3.5 w-3.5" /> Deletar
            </button>
          </div>
        </>
      )}

      {/* â”€â”€ Panel 1: File Explorer â”€â”€ */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
              Explorer
            </p>
            <p className="mt-0.5 truncate text-[12px] font-semibold text-slate-700 dark:text-zinc-300">
              {tree.name}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Nova pasta"
              onClick={() => {
                const folderName = prompt("Nome da pasta:");
                if (!folderName?.trim()) return;
                setTree((prev) => ({
                  ...prev,
                  folders: [
                    ...prev.folders,
                    {
                      id: uid(),
                      name: folderName.trim(),
                      expanded: true,
                      children: [],
                    },
                  ],
                }));
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <FiFolderPlus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Novo arquivo na raiz"
              onClick={() => {
                setAddingIn({ folderId: null, kind: "file" });
                setAddingName("");
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <FiFilePlus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto py-1">
          {dbLoading && (
            <div className="flex items-center gap-2 px-3 py-4 text-[11px] text-slate-400 dark:text-zinc-500">
              <span className="animate-pulse">â–Š</span> Carregando scripts...
            </div>
          )}
          {renderFile(tree.configFile, 0)}
          {tree.folders.map((folder) => renderFolder(folder, 0))}
        </div>
      </aside>

      {/* â”€â”€ Panel 2: Editor â”€â”€ */}
      <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950">
        {linkedTestCase && (
          <div className="border-b border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
            <button
              type="button"
              onClick={() => setLinkedBannerOpen((prev) => !prev)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] font-semibold text-amber-800 dark:text-amber-300"
            >
              <span className="truncate">
                Caso vinculado: {linkedTestCase.key ?? linkedTestCase.id.slice(0, 8)} — {linkedTestCase.title}
              </span>
              {linkedBannerOpen ? <FiChevronDown className="h-3.5 w-3.5 shrink-0" /> : <FiChevronRight className="h-3.5 w-3.5 shrink-0" />}
            </button>
            {linkedBannerOpen && (
              <div className="max-h-48 overflow-y-auto px-3 pb-3 text-[12px] text-amber-900 dark:text-amber-200">
                {linkedTestCase.objective && (
                  <p className="mb-2">
                    <span className="font-bold">Objetivo:</span> {linkedTestCase.objective}
                  </p>
                )}
                {linkedTestCase.steps.length > 0 && (
                  <ol className="list-decimal space-y-1 pl-4">
                    {linkedTestCase.steps.map((step) => (
                      <li key={step.id}>
                        {step.action} — <span className="italic">esperado: {step.expectedResult}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        )}
        {/* Tabs bar */}
        <div className="flex min-h-9 items-end gap-0 overflow-x-auto border-b border-slate-200 bg-slate-50 scrollbar-none dark:border-zinc-800 dark:bg-zinc-900">
          {openFiles.map((file) => {
            const isActive = file.id === activeFileId;
            return (
              <button
                type="button"
                key={file.id}
                onClick={() => setActiveFileId(file.id)}
                className={`group flex min-w-0 max-w-45 shrink-0 items-center gap-2 border-r px-3 py-2 text-[12px] transition-colors ${
                  isActive
                    ? "border-r-slate-200 border-t-2 border-t-[#ef0001] bg-white text-slate-900 dark:border-r-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                    : "border-r-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800 dark:border-r-zinc-800 dark:bg-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-300"
                }`}
              >
                <FiCode className="h-3 w-3 shrink-0 opacity-60" />
                <span className="min-w-0 truncate">{file.name}</span>
                <FiX
                  className="ml-0.5 h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60 hover:opacity-100!"
                  onClick={(e) => handleCloseTab(file.id, e)}
                />
              </button>
            );
          })}
        </div>

        {/* Editor toolbar */}
        {activeFile && (
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
            <span className="truncate text-[11px] text-slate-400 dark:text-zinc-500">
              {activeFile.path}
            </span>
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
              <StatusBadge status={activeFile.status} />
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1 text-[12px] text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <FiSave className="h-3.5 w-3.5" /> Salvar
              </button>
              {activeFile.status !== "published" && (
                <button
                  type="button"
                  onClick={handlePublish}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1 text-[12px] text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-800"
                >
                  <FiUploadCloud className="h-3.5 w-3.5" /> Publicar
                </button>
              )}
              <label
                className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg bg-slate-100 px-2 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-700"
                title="Abre uma aba de previa e executa Playwright com navegador visivel"
              >
                <input
                  type="checkbox"
                  checked={openBrowserOnRun}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setOpenBrowserOnRun(checked);
                    if (checked) {
                      setConfig((prev) => ({
                        ...prev,
                        browsers: [prev.browser],
                        headless: false,
                        workers: 1,
                      }));
                    }
                  }}
                  className="h-3.5 w-3.5 rounded accent-[#ef0001]"
                />
                <FiMonitor className="h-3.5 w-3.5" />
                Modo IDE
              </label>
              <select
                value={execMode}
                onChange={(e) => setExecMode(e.target.value as "spec" | "script")}
                className="h-7 rounded-lg bg-slate-100 px-2 text-[12px] font-semibold text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-[#ef0001] dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700"
                title="Modo de execução"
              >
                <option value="spec">Spec Playwright</option>
                <option value="script">Script Node</option>
              </select>
              <button
                type="button"
                onClick={() => (execMode === "script" ? void handleRunScript() : void handleRun())}
                disabled={isRunning || (execMode === "spec" && !hasRunnableSpecs)}
                className="flex items-center gap-1.5 rounded-lg bg-[#ef0001] px-3 py-1 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                title={execMode === "spec" && !hasRunnableSpecs ? "Crie um arquivo tests/*.spec.ts para habilitar a execução" : undefined}
              >
                <FiPlay className="h-3.5 w-3.5" />
                {isRunning ? "Executando..." : "Executar"}
              </button>
              <button
                type="button"
                onClick={() => setShowPublishDialog(true)}
                className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <FiGithub className="h-3.5 w-3.5" /> Enviar para GitHub
              </button>
              {execMode === "spec" && (
                <>
                  <select
                    value={runMode}
                    onChange={(e) => setRunMode(e.target.value as "all" | "changed" | "failed")}
                    className="h-7 rounded-lg bg-slate-100 px-2 text-[12px] text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-[#ef0001] dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700"
                    title="Modo de execução"
                  >
                    <option value="all">Modo: all specs</option>
                    <option value="changed">Modo: changed specs</option>
                    <option value="failed">Modo: failed specs</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleRun("changed")}
                    disabled={isRunning || !hasRunnableSpecs}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1 text-[12px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-900/20 dark:text-blue-300"
                    title="Executar somente specs alterados"
                  >
                    <FiZap className="h-3.5 w-3.5" /> Run changed specs
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRun("failed")}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-900/20 dark:text-amber-300"
                    title="Reexecutar apenas specs falhos da última run"
                  >
                    <FiRefreshCw className="h-3.5 w-3.5" /> Rerun failed
                  </button>
                </>
              )}
              {activeProject && (
                <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-zinc-800 dark:text-zinc-300" title="Projeto ativo para esta execução">
                  Projeto ativo: {activeProject.name}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Monaco editor */}
        {activeFile ? (
          <div className="min-h-0 flex-1">
            <MonacoEditor
              height="100%"
              language={activeFile.language}
              value={activeFile.content}
              onChange={handleEditorChange}
              theme={isDark ? "vs-dark" : "vs"}
              options={{
                fontSize: 13,
                fontFamily:
                  "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                lineNumbers: "on",
                folding: true,
                automaticLayout: true,
                tabSize: 2,
                insertSpaces: true,
                renderWhitespace: "selection",
                smoothScrolling: true,
                cursorSmoothCaretAnimation: "on",
              }}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-slate-400 dark:text-zinc-600">
            <div className="text-center">
              <FiCode className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">Selecione um arquivo para editar</p>
            </div>
          </div>
        )}
      </div>

      {/* â”€â”€ Panel 3: Config + Terminal + Runs + Agents â”€â”€ */}
      <aside className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-zinc-800">
          {(["config", "terminal", "runs", "agents"] as const).map((tab) => {
            const icons = {
              config: <FiSettings className="h-3 w-3" />,
              terminal: <FiTerminal className="h-3 w-3" />,
              runs: <FiClock className="h-3 w-3" />,
              agents: <FiZap className="h-3 w-3" />,
            };
            const labels = { config: "Config", terminal: "Log", runs: "Runs", agents: "IA" };
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setRightTab(tab)}
                className={`relative flex flex-1 items-center justify-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                  rightTab === tab
                    ? "border-b-2 border-[#ef0001] text-[#ef0001]"
                    : "text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300"
                }`}
              >
                {icons[tab]}
                {labels[tab]}
                {tab === "terminal" && isRunning && (
                  <span className="absolute right-1 top-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Panel content */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {rightTab === "config" && renderConfig()}
          {rightTab === "terminal" && renderTerminal()}
          {rightTab === "runs" && renderRuns()}
          {rightTab === "agents" && renderAgents()}
        </div>
      </aside>

      {showPublishDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
            <div className="flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-2 text-sm font-bold">
                <FiGithub className="h-4 w-4" />
                Publicar no GitHub
              </p>
              <button
                type="button"
                onClick={() => setShowPublishDialog(false)}
                aria-label="Fechar"
                className="text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-zinc-400">
              Publicar <span className="font-semibold">{activeFile?.path ?? "arquivo atual"}</span> em{" "}
              <span className="font-mono text-xs">AnaLysyk/Quality_Control</span>. Isso cria/atualiza uma branch e abre um Pull Request.
            </p>
            {publishMessage && (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs break-all text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {publishMessage}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPublishDialog(false)}
                className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-200 bg-transparent px-4 text-sm font-semibold text-slate-700 dark:border-zinc-700 dark:text-zinc-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void publishToGithub()}
                disabled={publishing || !activeFile}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-[#ef0001] px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                <FiGithub className="h-4 w-4" />
                {publishing ? "Publicando…" : "Confirmar publicação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
