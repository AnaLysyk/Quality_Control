import { prisma } from "@/database/prismaClient";
import { describeDb } from "../../../support/functions/banco-de-dados/descrever-banco";
import * as jiraSync from "@/backend/jiraSync";

describeDb("jiraSync.syncJiraIssuesToApplications", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("upserts applications for returned JIRA issues", async () => {
    const fakeIssues = [
      { id: "1001", key: "PROJ-1", summary: "First issue" },
      { id: "1002", key: "PROJ-2", summary: "Second issue" },
    ];

    // Mock company Jira credentials lookup
    jest.spyOn(prisma.company, "findUnique" as any).mockResolvedValue({
      jira_base_url: "https://jira.local",
      jira_email: "a@x.com",
      jira_api_token: "tok",
    } as any);

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

