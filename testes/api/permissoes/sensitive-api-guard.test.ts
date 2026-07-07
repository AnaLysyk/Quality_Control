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
});

