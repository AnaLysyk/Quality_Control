"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FiArrowLeft, FiCode, FiCpu, FiPlay, FiSave } from "react-icons/fi";
import AutomationCasesBoard from "../AutomationCasesBoard";
import { fetchApi } from "@/lib/api";
import { useAutomationModuleContext } from "../_components/AutomationModuleContext";

type TestCaseStep = {
  id: string;
  order: number;
  action: string;
  expectedResult: string;
};

type TestCaseApiRecord = {
  id: string;
  title: string;
  key: string;
  description?: string | null;
  preconditions?: string | null;
  source: string;
  type: string;
  automationStatus: string;
};

type AutomationLinkRecord = {
  id: string;
  repository?: string | null;
  branch?: string | null;
  specFile: string;
  testDescribe?: string | null;
  testTitle?: string | null;
  playwrightProject?: string | null;
  environment?: string | null;
  tags: string[];
  command?: string | null;
  pomPath?: string | null;
  fixtureNames: string[];
  locatorStrategy?: string | null;
  status: "active" | "broken" | "pending" | "disabled";
  lastStatus?: string | null;
  lastExecutedAt?: string | null;
  lastDurationMs?: number | null;
  lastTraceUrl?: string | null;
  lastVideoUrl?: string | null;
  lastScreenshotUrl?: string | null;
  lastErrorMessage?: string | null;
};

type AutomationApiPayload = {
  testCaseId: string;
  testCase: TestCaseApiRecord;
  steps: TestCaseStep[];
  automationLink: AutomationLinkRecord | null;
};

function splitTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function splitFixtureNames(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function buildSuggestedCommand(specFile: string, project: string, tags: string[], caseKey?: string) {
  const safeSpecFile = specFile.trim();
  if (!safeSpecFile) return "";

  const grepTag = tags.find((tag) => tag.startsWith("@")) ?? (caseKey ? `@${caseKey.toLowerCase()}` : "");
  const grepArg = grepTag ? ` --grep ${grepTag}` : "";
  const projectArg = project ? ` --project=${project}` : "";
  return `npx playwright test ${safeSpecFile}${grepArg}${projectArg}`.trim();
}

export default function AutomacoesCasosPage() {
  const searchParams = useSearchParams();
  const { access, activeClient, clients } = useAutomationModuleContext();
  const testCaseId = searchParams.get("testCaseId");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedCase, setLinkedCase] = useState<TestCaseApiRecord | null>(null);
  const [steps, setSteps] = useState<TestCaseStep[]>([]);
  const [automationId, setAutomationId] = useState<string | null>(null);
  const [repository, setRepository] = useState("");
  const [branch, setBranch] = useState("main");
  const [specFile, setSpecFile] = useState("");
  const [testDescribe, setTestDescribe] = useState("");
  const [testTitle, setTestTitle] = useState("");
  const [playwrightProject, setPlaywrightProject] = useState("chromium");
  const [environment, setEnvironment] = useState("homolog");
  const [tags, setTags] = useState("");
  const [command, setCommand] = useState("");
  const [pomPath, setPomPath] = useState("");
  const [fixtureNames, setFixtureNames] = useState("");
  const [locatorStrategy, setLocatorStrategy] = useState("getByRole/getByTestId");
  const [linkStatus, setLinkStatus] = useState<AutomationLinkRecord["status"]>("pending");
  const [lastExecution, setLastExecution] = useState<AutomationLinkRecord | null>(null);

  useEffect(() => {
    if (!testCaseId) {
      setLinkedCase(null);
      setSteps([]);
      setAutomationId(null);
      setError(null);
      return;
    }

    let canceled = false;
    setLoading(true);
    setError(null);

    async function loadCase() {
      const caseId = testCaseId;
      if (!caseId) return;
      try {
        const response = await fetchApi(`/api/test-cases/${encodeURIComponent(caseId)}/automation`);
        if (!response.ok) throw new Error("Não foi possível carregar o contexto Playwright do caso.");
        const payload = (await response.json()) as AutomationApiPayload;
        if (canceled) return;

        setLinkedCase(payload.testCase ?? null);
        setSteps(payload.steps ?? []);
        setAutomationId(payload.automationLink?.id ?? null);
        setRepository(payload.automationLink?.repository ?? "");
        setBranch(payload.automationLink?.branch ?? "main");
        setSpecFile(payload.automationLink?.specFile ?? "");
        setTestDescribe(payload.automationLink?.testDescribe ?? "");
        setTestTitle(payload.automationLink?.testTitle ?? payload.testCase?.title ?? "");
        setPlaywrightProject(payload.automationLink?.playwrightProject ?? "chromium");
        setEnvironment(payload.automationLink?.environment ?? "homolog");
        setTags((payload.automationLink?.tags ?? []).join(" "));
        setCommand(payload.automationLink?.command ?? "");
        setPomPath(payload.automationLink?.pomPath ?? "");
        setFixtureNames((payload.automationLink?.fixtureNames ?? []).join(", "));
        setLocatorStrategy(payload.automationLink?.locatorStrategy ?? "getByRole/getByTestId");
        setLinkStatus(payload.automationLink?.status ?? "pending");
        setLastExecution(payload.automationLink ?? null);
      } catch (cause) {
        if (!canceled) {
          setLinkedCase(null);
          setSteps([]);
          setAutomationId(null);
          setError(cause instanceof Error ? cause.message : "Falha ao carregar caso.");
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    void loadCase();

    return () => {
      canceled = true;
    };
  }, [testCaseId]);

  const companyOptions = useMemo(
    () =>
      clients.map((company) => ({
        name: company.name,
        slug: company.slug,
      })),
    [clients],
  );

  const parsedTags = useMemo(() => splitTags(tags), [tags]);
  const parsedFixtures = useMemo(() => splitFixtureNames(fixtureNames), [fixtureNames]);
  const suggestedCommand = useMemo(
    () => buildSuggestedCommand(specFile, playwrightProject, parsedTags, linkedCase?.key),
    [linkedCase?.key, parsedTags, playwrightProject, specFile],
  );
  const effectiveCommand = command.trim() || suggestedCommand;

  async function handleSaveLink() {
    if (!testCaseId) return;
    setSaving(true);
    setError(null);
    try {
      const endpoint = automationId
        ? `/api/test-cases/${encodeURIComponent(testCaseId)}/automation/${encodeURIComponent(automationId)}`
        : `/api/test-cases/${encodeURIComponent(testCaseId)}/automation`;
      const response = await fetchApi(endpoint, {
        method: automationId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository,
          branch,
          specFile,
          testDescribe,
          testTitle,
          playwrightProject,
          environment,
          tags: parsedTags,
          command: effectiveCommand,
          pomPath,
          fixtureNames: parsedFixtures,
          locatorStrategy,
          status: linkStatus,
        }),
      });
      if (!response.ok) {
        const payloadError = await response.json().catch(() => null);
        throw new Error(payloadError?.message || "Não foi possível salvar vínculo de automação.");
      }
      const payload = (await response.json()) as AutomationApiPayload;
      setLinkedCase(payload.testCase ?? null);
      setSteps(payload.steps ?? []);
      setAutomationId(payload.automationLink?.id ?? null);
      setLastExecution(payload.automationLink ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar vínculo.");
    } finally {
      setSaving(false);
    }
  }

  if (!testCaseId) {
    return (
      <AutomationCasesBoard
        access={access}
        activeCompanySlug={activeClient?.slug ?? null}
        companies={companyOptions}
      />
    );
  }

  return (
    <section
      data-testid="automation-context"
      className="space-y-4 rounded-[28px] border border-(--tc-border,#d7deea) bg-(--tc-surface,#ffffff) p-5 shadow-sm"
    >
      <header className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--tc-accent,#ef0001)">Automação Playwright</p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.03em] text-(--tc-text,#0b1a3c)">
              {loading ? "Carregando caso..." : linkedCase ? `${linkedCase.key} - ${linkedCase.title}` : `Caso ${testCaseId}`}
            </h1>
            <p className="mt-2 text-sm text-(--tc-text-secondary,#4b5563)">
              O caso continua único no repositório. Esta tela edita apenas o vínculo técnico do Playwright.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/casos-de-teste"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-(--tc-border,#d7deea) bg-white px-4 py-2 text-sm font-semibold text-(--tc-text,#0b1a3c)"
            >
              <FiArrowLeft className="h-4 w-4" />
              Voltar ao repositório
            </Link>
            <button
              type="button"
              data-testid="automation-save-link-button"
              onClick={() => void handleSaveLink()}
              disabled={saving || loading || !linkedCase || !specFile.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-(--tc-primary,#011848) px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <FiSave className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar vínculo"}
            </button>
          </div>
        </div>
      </header>

      <div
        data-testid="automation-linked-test-case"
        className="grid gap-3 rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-(--tc-text-muted,#6b7280)">Caso vinculado</p>
          <p className="mt-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">{linkedCase ? `${linkedCase.key} - ${linkedCase.title}` : "Caso indisponível"}</p>
          <p className="mt-2 text-sm leading-6 text-(--tc-text-secondary,#4b5563)">{linkedCase?.description || "Sem descrição detalhada."}</p>
          {linkedCase?.preconditions ? (
            <p className="mt-3 text-sm text-(--tc-text,#0b1a3c)">
              <strong>Pré-condições:</strong> {linkedCase.preconditions}
            </p>
          ) : null}
        </div>
        <div className="space-y-2 text-sm text-(--tc-text,#0b1a3c)">
          <p><strong>Origem:</strong> {linkedCase?.source || "manual"}</p>
          <p><strong>Tipo:</strong> {linkedCase?.type || "manual"}</p>
          <p><strong>Status de automação:</strong> {linkedCase?.automationStatus || "none"}</p>
          <Link href={`/casos-de-teste?case=${encodeURIComponent(testCaseId)}`} className="inline-flex items-center gap-2 text-sm font-semibold text-(--tc-accent,#ef0001)">
            Editar caso no repositório
          </Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <main className="space-y-4">
          <section data-testid="automation-panel" className="rounded-2xl border border-(--tc-border,#d7deea) bg-white p-4">
            <div className="flex items-center gap-2">
              <FiCode className="h-4 w-4 text-(--tc-accent,#ef0001)" />
              <h2 className="text-sm font-black text-(--tc-text,#0b1a3c)">Vínculo Playwright</h2>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <Field label="Repositório" value={repository} onChange={setRepository} placeholder="AnaLysyk/Quality_Control" />
              <Field label="Branch" value={branch} onChange={setBranch} placeholder="main" />
              <Field
                testId="automation-spec-file-input"
                label="Spec file"
                value={specFile}
                onChange={setSpecFile}
                placeholder="tests-e2e/auth/login.spec.ts"
              />
              <Field
                testId="automation-test-title-input"
                label="Test title"
                value={testTitle}
                onChange={setTestTitle}
                placeholder="deve validar login com usuário válido"
              />
              <Field label="test.describe" value={testDescribe} onChange={setTestDescribe} placeholder="Autenticação" />
              <SelectField
                testId="automation-project-select"
                label="Project"
                value={playwrightProject}
                onChange={setPlaywrightProject}
                options={["chromium", "edge", "firefox", "webkit"]}
              />
              <Field label="Ambiente" value={environment} onChange={setEnvironment} placeholder="homolog" />
              <SelectField label="Status do vínculo" value={linkStatus} onChange={(value) => setLinkStatus(value as AutomationLinkRecord["status"])} options={["pending", "active", "broken", "disabled"]} />
              <Field testId="automation-tags-input" label="Tags" value={tags} onChange={setTags} placeholder="@tc-001 @smoke @auth" />
              <Field label="Locator strategy" value={locatorStrategy} onChange={setLocatorStrategy} placeholder="getByRole/getByTestId" />
              <Field testId="automation-pom-path-input" label="POM path" value={pomPath} onChange={setPomPath} placeholder="tests-e2e/pages/LoginPage.ts" />
              <Field testId="automation-fixtures-input" label="Fixtures" value={fixtureNames} onChange={setFixtureNames} placeholder="authenticatedPage, testUser" />
            </div>

            <label className="mt-3 grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
              Command
              <textarea
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder={suggestedCommand || "npx playwright test ..."}
                className="min-h-24 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 py-3 text-sm outline-none transition focus:border-(--tc-accent,#ef0001)"
              />
            </label>

            <div data-testid="automation-command-preview" className="mt-3 rounded-2xl border border-dashed border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) px-4 py-3 text-sm text-(--tc-text,#0b1a3c)">
              <strong>Comando sugerido:</strong> {effectiveCommand || "Preencha o spec file para gerar o comando Playwright."}
            </div>
          </section>

          {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
        </main>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
            <div className="flex items-center gap-2">
              <FiCpu className="h-4 w-4 text-(--tc-accent,#ef0001)" />
              <h2 className="text-sm font-black text-(--tc-text,#0b1a3c)">Mapeamento do caso</h2>
            </div>

            <div className="mt-3 space-y-3">
              {steps.length > 0 ? (
                steps.map((step) => (
                  <div key={step.id} className="rounded-2xl border border-(--tc-border,#d7deea) bg-white p-3 text-sm text-(--tc-text,#0b1a3c)">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--tc-accent,#ef0001)">Passo {step.order}</p>
                    <p className="mt-2"><strong>Ação:</strong> {step.action}</p>
                    <p className="mt-1"><strong>Esperado:</strong> {step.expectedResult}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-(--tc-text-secondary,#4b5563)">O caso ainda não possui passos cadastrados.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-(--tc-border,#d7deea) bg-(--tc-surface-2,#f8fafc) p-4">
            <div className="flex items-center gap-2">
              <FiPlay className="h-4 w-4 text-(--tc-accent,#ef0001)" />
              <h2 className="text-sm font-black text-(--tc-text,#0b1a3c)">Última execução conhecida</h2>
            </div>

            <div className="mt-3 space-y-2 text-sm text-(--tc-text,#0b1a3c)">
              <p><strong>Status:</strong> {lastExecution?.lastStatus || "Ainda não executado"}</p>
              <p><strong>Executado em:</strong> {lastExecution?.lastExecutedAt || "Sem histórico"}</p>
              <p><strong>Duração:</strong> {lastExecution?.lastDurationMs ? `${lastExecution.lastDurationMs} ms` : "Sem histórico"}</p>
              <p><strong>Trace:</strong> {lastExecution?.lastTraceUrl || "Não disponível"}</p>
              <p><strong>Screenshot:</strong> {lastExecution?.lastScreenshotUrl || "Não disponível"}</p>
              <p><strong>Vídeo:</strong> {lastExecution?.lastVideoUrl || "Não disponível"}</p>
              {lastExecution?.lastErrorMessage ? <p><strong>Erro:</strong> {lastExecution.lastErrorMessage}</p> : null}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
      {label}
      <input
        data-testid={testId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none transition focus:border-(--tc-accent,#ef0001)"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  testId?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-(--tc-text,#0b1a3c)">
      {label}
      <select
        data-testid={testId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-2xl border border-(--tc-border,#d7deea) bg-white px-4 text-sm outline-none transition focus:border-(--tc-accent,#ef0001)"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

