import "server-only";

const SAFE_ENV_KEYS = [
  "PATH",
  "Path",
  "PATHEXT",
  "SystemRoot",
  "SYSTEMROOT",
  "WINDIR",
  "TEMP",
  "TMP",
  "TMPDIR",
] as const;

export class EmbeddedAutomationExecutionDisabledError extends Error {
  constructor() {
    super(
      "O runner embutido está desativado. Execute automações em um worker isolado ou habilite explicitamente apenas no desenvolvimento local.",
    );
    this.name = "EmbeddedAutomationExecutionDisabledError";
  }
}

/**
 * Código fornecido pelo usuário nunca deve executar dentro do servidor web em
 * produção. O modo local existe somente para desenvolvimento controlado.
 */
export function isEmbeddedAutomationExecutionEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_UNSANDBOXED_AUTOMATION_EXECUTION === "true"
  );
}

export function assertEmbeddedAutomationExecutionEnabled() {
  if (!isEmbeddedAutomationExecutionEnabled()) {
    throw new EmbeddedAutomationExecutionDisabledError();
  }
}

/**
 * Nunca repassa DATABASE_URL, JWT_SECRET, tokens de integrações ou o restante
 * do ambiente do processo web ao código executado. Segredos próprios do
 * runner devem ser configurados com o prefixo AUTOMATION_RUNNER_.
 */
export function buildAutomationRunnerEnvironment(
  extra: Record<string, string> = {},
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    CI: "true",
  };

  for (const key of SAFE_ENV_KEYS) {
    const value = process.env[key];
    if (value) environment[key] = value;
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("AUTOMATION_RUNNER_") && typeof value === "string") {
      environment[key] = value;
    }
  }

  return { ...environment, ...extra };
}
