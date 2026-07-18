/// <reference types="node" />
/// <reference types="jest" />
import * as fs from "node:fs";
import * as path from "node:path";

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry: fs.Dirent) => {
    const absolutePath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(absolutePath) : [absolutePath];
  });
}

function toProjectPath(filePath: string) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

const SENSITIVE_API_PATTERNS = [
  /^app\/api\/admin\//,
  /^app\/api\/debug\//,
  /^app\/api\/dashboard\//,
  /^app\/api\/(users?|profile|companies?|clients?|applications)(\/|$)/,
  /^app\/api\/.*(permissions?|profile-permissions|user-permissions)/,
  /^app\/api\/.*(company-docs|company-documents|platform-docs|notes)/,
  /^app\/api\/.*(tickets?|chamados|suportes|support)/,
  /^app\/api\/.*(audit|settings|integrations|qase|jira|s3)/,
  /^app\/api\/brain\//,
  /^app\/api\/.*(operacao|quality|runs?|defects?|defeitos|release|test-cases|test-plans|test-runs|test-projects|automations)/,
];

const DOCUMENTED_PUBLIC_EXCEPTIONS = [
  /^app\/api\/_test\//,
  /^app\/api\/access-requests\/public\/route\.ts$/,
  /^app\/api\/support\/forgot-password\/route\.ts$/,
  /^app\/api\/support\/access-request\/(lookup|comments|update)\/route\.ts$/,
  /^app\/api\/brain\/health\/route\.ts$/,
  /^app\/api\/brain\/weather\/route\.ts$/,
  /^app\/api\/suportes\/route\.ts$/,
];

const SERVER_SIDE_ACCESS_GUARD =
  /requirePermission\(|requireGlobalAdmin|requireAccessRequestReviewerWithStatus\(|resolveBrainAccess\(|resolveOperationalContext\(|validarAcessoUsuariosNoServidor\(|getAccessContext\(|authenticateRequest\(|hasPermissionAccess\(|canAccess\w*\(|assertCompanyAccess\(|require\w*Access\(|canReview\w*\(|canMove\w*\(|canCreate\w*\(|canDelete\w*\(|canManage\w*\(|canView\w*\(|isItDev\(|getMockRole\(|rateLimit\(/;

describe("sensitive API server-side guards", () => {
  it("mantem endpoints sensiveis com validacao server-side explicita", () => {
    const routeFiles = walk(path.join(process.cwd(), "app", "api"))
      .filter((filePath) => /route\.tsx?$/.test(filePath))
      .map(toProjectPath);

    const unguardedRoutes = routeFiles
      .filter((filePath) => SENSITIVE_API_PATTERNS.some((pattern) => pattern.test(filePath)))
      .filter((filePath) => !DOCUMENTED_PUBLIC_EXCEPTIONS.some((pattern) => pattern.test(filePath)))
      .filter((filePath) => !SERVER_SIDE_ACCESS_GUARD.test(fs.readFileSync(path.join(process.cwd(), filePath), "utf8")));

    expect(unguardedRoutes).toEqual([]);
  });

  it("nao permite que endpoints de diagnostico devolvam segredos de ambiente", () => {
    const debugRoutes = walk(path.join(process.cwd(), "app", "api", "debug"))
      .filter((filePath) => /route\.tsx?$/.test(filePath));

    for (const filePath of debugRoutes) {
      const source = fs.readFileSync(filePath, "utf8");
      expect(source).not.toMatch(/DATABASE_URL:\s*process\.env\.DATABASE_URL/);
      expect(source).not.toMatch(/POSTGRES_PRISMA_URL:\s*process\.env\.POSTGRES_PRISMA_URL/);
    }
  });

  it("protege autenticação, recuperação e armazenamento de senhas", () => {
    const loginRoute = fs.readFileSync(path.join(process.cwd(), "app/api/auth/login/route.ts"), "utf8");
    const directResetRoute = fs.readFileSync(path.join(process.cwd(), "app/api/auth/reset-direct/route.ts"), "utf8");
    const verifyResetRoute = fs.readFileSync(path.join(process.cwd(), "app/api/auth/reset-verify/route.ts"), "utf8");

    expect(loginRoute).toMatch(/verifyPassword\(/);
    expect(loginRoute).toMatch(/rateLimit\(/);
    expect(loginRoute).not.toMatch(/Erro interno:\s*["'`]\s*\+/);
    expect(directResetRoute).toMatch(/isE2eMockAllowed\(\)/);
    expect(verifyResetRoute).toMatch(/isE2eMockAllowed\(\)/);

    const productionSources = ["app", "backend"]
      .flatMap((directory) => walk(path.join(process.cwd(), directory)))
      .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
      .filter((filePath) => !filePath.endsWith(path.join("backend", "passwordHash.ts")));

    const legacyHashCallers = productionSources
      .filter((filePath) => /hashPasswordSha256\(/.test(fs.readFileSync(filePath, "utf8")))
      .map(toProjectPath);
    expect(legacyHashCallers).toEqual([]);
  });

  it("mantem rotas de teste fail-closed e não expõe erros internos", () => {
    const testRoute = fs.readFileSync(path.join(process.cwd(), "app/api/_test/quality-alerts/route.ts"), "utf8");
    expect(testRoute).toMatch(/isE2eMockAllowed\(\)/);
    expect(testRoute).not.toMatch(/E2E_USE_JSON|NODE_ENV\s*===\s*["']test["']/);

    const routeFiles = walk(path.join(process.cwd(), "app", "api"))
      .filter((filePath) => /route\.tsx?$/.test(filePath));
    const leakingInternalErrors = routeFiles
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return /NextResponse\.json\([\s\S]{0,120}(?:error|details):\s*(?:message|msg|error\.message)[\s\S]{0,120}status:\s*500/.test(source);
      })
      .map(toProjectPath);

    expect(leakingInternalErrors).toEqual([]);
  });

  it("protege consultas públicas e códigos de acesso contra abuso", () => {
    const publicRoutes = [
      "app/api/access-requests/by-key/[key]/route.ts",
      "app/api/access-requests/by-key/[key]/cancel/route.ts",
      "app/api/support/access-request/comments/route.ts",
      "app/api/support/access-request/update/route.ts",
      "app/api/public/company-lookup/cep/route.ts",
      "app/api/public/company-lookup/cnpj/route.ts",
    ];

    for (const route of publicRoutes) {
      expect(fs.readFileSync(path.join(process.cwd(), route), "utf8")).toMatch(/rateLimit\(/);
    }

    const redisPing = fs.readFileSync(path.join(process.cwd(), "app/api/public/redis/ping/route.ts"), "utf8");
    expect(redisPing).not.toMatch(/searchParams\.get\(["']secret["']\)/);
    expect(redisPing).not.toMatch(/details:\s*(?:msg|message|error\.message)/);
  });

  it("não mantém credenciais administrativas em scripts de seed ou diagnóstico", () => {
    const adminSeeds = [
      "tools/functions/banco-de-dados/usuarios/criar-administrador.ts",
      "tools/functions/banco-de-dados/usuarios/criar-administrador-ana.ts",
    ].map((filePath) => fs.readFileSync(path.join(process.cwd(), filePath), "utf8"));

    for (const source of adminSeeds) {
      expect(source).toMatch(/requiredEnv\(/);
      expect(source).toMatch(/hashPassword\(/);
      expect(source).not.toMatch(/hashPasswordSha256\(/);
      expect(source).not.toMatch(/(?:password|senha)\s*=\s*["'][^"']+["']/i);
    }

    const envInspector = fs.readFileSync(
      path.join(process.cwd(), "tools/functions/infraestrutura/ambiente/mostrar-variaveis-banco.js"),
      "utf8",
    );
    expect(envInspector).not.toMatch(/console\.log\([^\n]*process\.env\.(?:DATABASE_URL|POSTGRES_PRISMA_URL)/);

    const toolSources = walk(path.join(process.cwd(), "tools"))
      .filter((filePath) => /\.(?:ts|js|mjs)$/.test(filePath))
      .map((filePath) => fs.readFileSync(filePath, "utf8"))
      .join("\n");
    expect(toolSources).not.toMatch(/griaule4096|Griaule@123/);

    const browserDiagnostic = fs.readFileSync(
      path.join(process.cwd(), "tools/functions/ui/diagnosticos/diagnosticar-login-navegador.mjs"),
      "utf8",
    );
    expect(browserDiagnostic).toMatch(/redactHeaders\(/);
    expect(browserDiagnostic).toMatch(/REDACTED LOGIN PAYLOAD/);
  });

  it("nunca carrega contas demo embutidas em produção", () => {
    const localStore = fs.readFileSync(path.join(process.cwd(), "backend/auth/localStore.ts"), "utf8");
    expect(localStore).toMatch(/process\.env\.NODE_ENV\s*===\s*["']production["']\)\s*return false/);
    expect(localStore).toMatch(/if \(canLoadBundledDemoUsers\(\)\)/);
  });
});
