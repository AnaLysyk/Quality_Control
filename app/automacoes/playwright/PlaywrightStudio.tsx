"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiCode,
  FiCopy,
  FiEdit2,
  FiFile,
  FiFilePlus,
  FiFolder,
  FiFolderPlus,
  FiPlay,
  FiSave,
  FiSettings,
  FiTerminal,
  FiTrash2,
  FiUploadCloud,
  FiX,
} from "react-icons/fi";

// Monaco Editor is large — load dynamically to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// ── DB helpers ────────────────────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

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

type RightPanelTab = "config" | "terminal";

type CompanyOption = { name: string; slug: string };

// ── Default templates ────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Status badge ──────────────────────────────────────────────────────────────

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

// ── Terminal line colors ──────────────────────────────────────────────────────

const TERM_COLORS: Record<TerminalLine["type"], string> = {
  system: "text-blue-400",
  info: "text-zinc-400",
  success: "text-emerald-400",
  error: "text-red-400",
  warn: "text-amber-400",
};

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  activeCompanySlug: string | null;
  companies: CompanyOption[];
};

export default function PlaywrightStudio({ activeCompanySlug, companies }: Props) {
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
    headless: true,
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
  const terminalRef = useRef<HTMLDivElement>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);

  // ── Detect app theme for Monaco ──────────────────────────────────────────

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

  // ── DB: load scripts on company change ────────────────────────────────────

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

  // ── Handlers ──────────────────────────────────────────────────────────────

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

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setRightTab("terminal");
    setTerminal([]);

    const steps = [
      { type: "system" as const, text: "► Iniciando execução Playwright..." },
      {
        type: "info" as const,
        text: `  Config: browser=${config.browser}, headless=${config.headless}, workers=${config.workers}`,
      },
      { type: "info" as const, text: `  baseURL: ${config.baseURL}` },
      { type: "info" as const, text: "" },
      { type: "info" as const, text: "  Running 3 tests using 2 workers" },
      { type: "info" as const, text: "" },
      {
        type: "success" as const,
        text: "  ✓ [chromium] Login › should login with valid credentials (1.2s)",
      },
      {
        type: "success" as const,
        text: "  ✓ [chromium] Login › should show error with invalid credentials (0.8s)",
      },
      {
        type: "success" as const,
        text: "  ✓ [chromium] Login › should redirect unauthenticated users (0.6s)",
      },
      { type: "info" as const, text: "" },
      { type: "success" as const, text: "  3 passed (3.2s)" },
      { type: "system" as const, text: "► Execução concluída com sucesso." },
    ];

    for (const step of steps) {
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
      addTerminalLine(step.type, step.text);
    }

    setIsRunning(false);
  }, [isRunning, config, addTerminalLine]);

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

  // ── Render: File Tree Node ─────────────────────────────────────────────────

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

  // ── Render: Config Panel ───────────────────────────────────────────────────

  function renderConfig() {
    return (
      <div className="space-y-4 overflow-auto p-4 text-[13px]">
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
                  }))
                }
                className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
              >
                <option value="chromium">Chromium</option>
                <option value="firefox">Firefox</option>
                <option value="webkit">WebKit (Safari)</option>
              </select>
            </label>
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
          </div>
        )}
      </div>
    );
  }

  // ── Render: Terminal ──────────────────────────────────────────────────────

  function renderTerminal() {
    return (
      <div
        ref={terminalRef}
        className="h-full overflow-auto bg-[#1e1e1e] p-4 font-mono text-[12px]"
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
            <span className="animate-pulse">▊</span>
          </div>
        )}
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 bg-[#f3f6fb] text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">
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

      {/* ── Panel 1: File Explorer ── */}
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
              <span className="animate-pulse">▊</span> Carregando scripts...
            </div>
          )}
          {renderFile(tree.configFile, 0)}
          {tree.folders.map((folder) => renderFolder(folder, 0))}
        </div>
      </aside>

      {/* ── Panel 2: Editor ── */}
      <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950">
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
            <div className="ml-auto flex items-center gap-2">
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
              <button
                type="button"
                onClick={handleRun}
                disabled={isRunning}
                className="flex items-center gap-1.5 rounded-lg bg-[#ef0001] px-3 py-1 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                <FiPlay className="h-3.5 w-3.5" />
                {isRunning ? "Executando..." : "Executar"}
              </button>
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

      {/* ── Panel 3: Config + Terminal ── */}
      <aside className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setRightTab("config")}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
              rightTab === "config"
                ? "border-b-2 border-[#ef0001] text-[#ef0001]"
                : "text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300"
            }`}
          >
            <FiSettings className="h-3.5 w-3.5" />
            Config
          </button>
          <button
            type="button"
            onClick={() => setRightTab("terminal")}
            className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
              rightTab === "terminal"
                ? "border-b-2 border-[#ef0001] text-[#ef0001]"
                : "text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300"
            }`}
          >
            <FiTerminal className="h-3.5 w-3.5" />
            Terminal
            {isRunning && (
              <span className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 animate-pulse rounded-full bg-emerald-500" />
            )}
          </button>
        </div>

        {/* Panel content */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {rightTab === "config" ? renderConfig() : renderTerminal()}
        </div>
      </aside>
    </div>
  );
}
