import { prisma } from "@/lib/prismaClient";
import * as jiraSync from "@/lib/jiraSync";

describe("jiraSync.syncJiraIssuesToApplications", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("upserts applications for returned JIRA issues", async () => {
    const fakeIssues = [
      { id: "1001", key: "PROJ-1", summary: "First issue" },
      { id: "1002", key: "PROJ-2", summary: "Second issue" },
    ];

    // Mock integrations config lookup
    const integrations = await import("@/lib/integrations");
    jest.spyOn(integrations, "getCompanyIntegrationConfig").mockResolvedValue({ baseUrl: "https://jira.local", email: "a@x.com", token: "tok" } as any);

    // Mock global fetch to return fake issues
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ issues: fakeIssues }) });

    const upsertMock = jest.spyOn(prisma.application, "upsert" as any).mockImplementation(async (args: any) => {
      return { id: args.create.id ?? "x", slug: args.create.slug, name: args.create.name } as any;
    });

    const res = await jiraSync.syncJiraIssuesToApplications("test-company", 10);

    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBe(2);
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ where: expect.any(Object), create: expect.any(Object), update: expect.any(Object) }));
  });
});
