import type { AuthUser } from "@/backend/jwtAuth";
import {
  canAccessCompany,
  canAccessProject,
  canAccessSensitivity,
  getCompanyProjectAccess,
} from "@/backend/test-data-hub/permissions";
import {
  createTestDataDownloadToken,
  verifyTestDataDownloadToken,
} from "@/backend/test-data-hub/downloadToken";

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    email: "qa@example.test",
    isGlobalAdmin: false,
    role: "qa_tc",
    companySlug: "company-a",
    companySlugs: ["company-a", "company-b"],
    projectScope: "restricted",
    assignments: [
      {
        companyId: "company-a-id",
        companySlug: "company-a",
        projectId: "project-a1",
        projectSlug: "a1",
        projectAccess: "selected_projects",
        role: "qa_tc",
        status: "active",
        source: "project_assignment",
      },
      {
        companyId: "company-b-id",
        companySlug: "company-b",
        projectId: null,
        projectSlug: null,
        projectAccess: "company_only",
        role: "company_user",
        status: "active",
        source: "membership",
      },
    ],
    ...overrides,
  };
}

describe("test-data hub security", () => {
  it("preserves exact company/project pairs", () => {
    const access = user();

    expect(canAccessCompany(access, "company-a")).toBe(true);
    expect(canAccessProject(access, "company-a", "project-a1")).toBe(true);
    expect(canAccessProject(access, "company-a", "project-a2")).toBe(false);
    expect(canAccessCompany(access, "company-b")).toBe(true);
    expect(canAccessProject(access, "company-b", null)).toBe(true);
    expect(canAccessProject(access, "company-b", "project-a1")).toBe(false);
    expect(canAccessCompany(access, "company-c")).toBe(false);
  });

  it("returns an explicit selected-project filter", () => {
    expect(getCompanyProjectAccess(user(), "company-a")).toEqual({
      companyAllowed: true,
      allProjects: false,
      projectIds: ["project-a1"],
    });
  });

  it("limits regular QA users to internal sensitivity", () => {
    const access = user();
    expect(canAccessSensitivity(access, "public")).toBe(true);
    expect(canAccessSensitivity(access, "internal")).toBe(true);
    expect(canAccessSensitivity(access, "restricted")).toBe(false);
    expect(canAccessSensitivity(access, "sensitive")).toBe(false);
  });

  it("signs downloads for one user, asset and purpose", () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "test-data-download-secret-with-enough-entropy";
    try {
      const token = createTestDataDownloadToken({
        assetId: "asset-1",
        userId: "user-1",
        purpose: "test_execution",
      });

      expect(verifyTestDataDownloadToken(token, {
        assetId: "asset-1",
        userId: "user-1",
        purpose: "test_execution",
      }).valid).toBe(true);
      expect(verifyTestDataDownloadToken(token, {
        assetId: "asset-1",
        userId: "user-2",
        purpose: "test_execution",
      }).valid).toBe(false);
      expect(verifyTestDataDownloadToken(`${token}x`, {
        assetId: "asset-1",
        userId: "user-1",
        purpose: "test_execution",
      }).valid).toBe(false);
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  });
});
