import {
  buildAutomationRunnerEnvironment,
  isEmbeddedAutomationExecutionEnabled,
} from "@/backend/playwright/executionPolicy";

describe("automation execution policy", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.ALLOW_UNSANDBOXED_AUTOMATION_EXECUTION;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalRunnerToken = process.env.AUTOMATION_RUNNER_TEST_TOKEN;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) delete process.env.ALLOW_UNSANDBOXED_AUTOMATION_EXECUTION;
    else process.env.ALLOW_UNSANDBOXED_AUTOMATION_EXECUTION = originalFlag;
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    if (originalRunnerToken === undefined) delete process.env.AUTOMATION_RUNNER_TEST_TOKEN;
    else process.env.AUTOMATION_RUNNER_TEST_TOKEN = originalRunnerToken;
  });

  it("never enables the embedded runner in production", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_UNSANDBOXED_AUTOMATION_EXECUTION = "true";
    expect(isEmbeddedAutomationExecutionEnabled()).toBe(false);
  });

  it("requires an explicit local-development flag", () => {
    process.env.NODE_ENV = "test";
    process.env.ALLOW_UNSANDBOXED_AUTOMATION_EXECUTION = "false";
    expect(isEmbeddedAutomationExecutionEnabled()).toBe(false);
    process.env.ALLOW_UNSANDBOXED_AUTOMATION_EXECUTION = "true";
    expect(isEmbeddedAutomationExecutionEnabled()).toBe(true);
  });

  it("does not leak web-server secrets to child processes", () => {
    process.env.DATABASE_URL = "postgresql://sensitive";
    process.env.JWT_SECRET = "sensitive-jwt";
    process.env.AUTOMATION_RUNNER_TEST_TOKEN = "runner-only";

    const environment = buildAutomationRunnerEnvironment({ RUN_ID: "run-1" });

    expect(environment.DATABASE_URL).toBeUndefined();
    expect(environment.JWT_SECRET).toBeUndefined();
    expect(environment.AUTOMATION_RUNNER_TEST_TOKEN).toBe("runner-only");
    expect(environment.RUN_ID).toBe("run-1");
  });

  it("keeps process spawning free of shell interpolation and full env spreading", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "backend", "playwright", "executionService.ts"),
      "utf8",
    );
    expect(source).not.toContain("...process.env");
    expect(source).not.toMatch(/shell:\s*process\.platform/);
    expect(source).toContain("shell: false");
  });
});
import fs from "node:fs";
import path from "node:path";
