type StoredTestCaseRow = {
  id: string;
  companyId: string | null;
  data: unknown;
};

const storedRows: StoredTestCaseRow[] = [];

const storedTestCaseDelegate = {
  findMany: jest.fn(async () => [...storedRows].reverse()),
  upsert: jest.fn(async ({ where, update, create }: any) => {
    const idx = storedRows.findIndex((row) => row.id === where.id);
    const next = idx >= 0 ? { ...storedRows[idx], ...update } : { ...create };

    if (idx >= 0) {
      storedRows[idx] = next;
    } else {
      storedRows.push(next);
    }

    return next;
  }),
  deleteMany: jest.fn(async ({ where }: any) => {
    const keepIds: string[] = where?.id?.notIn ?? [];
    for (let i = storedRows.length - 1; i >= 0; i -= 1) {
      if (!keepIds.includes(storedRows[i].id)) {
        storedRows.splice(i, 1);
      }
    }
    return { count: 0 };
  }),
};

const prismaMock = {
  storedTestCase: storedTestCaseDelegate,
  $transaction: jest.fn(async (callback: any) => callback({ storedTestCase: storedTestCaseDelegate })),
};

jest.mock("@/backend/storeMode", () => ({
  shouldUseJsonStore: jest.fn(() => false),
}));
jest.mock("@/database/prismaClient", () => ({
  prisma: prismaMock,
}));

jest.mock("@/backend/test-cases/testCaseMappers", () => ({
  listSeedTestCaseRecords: jest.fn(() => []),
}));

import {
  createManualTestCaseRecord,
  saveTestCaseAutomationLink,
  updateTestCaseRecord,
} from "@/backend/test-cases/testCaseRepository";

describe("test case repository contracts", () => {
  beforeEach(() => {
    storedRows.length = 0;
    jest.clearAllMocks();
  });

  it("rejects steps without expected result", async () => {
    await expect(
      createManualTestCaseRecord(
        {
          title: "Caso sem expected",
          steps: [
            {
              action: "Clicar em Salvar",
              expectedResult: "   ",
            },
          ],
        },
        "u-1",
      ),
    ).rejects.toThrow("STEP_EXPECTED_RESULT_REQUIRED");
  });

  it("rejects invalid enum patch values", async () => {
    const record = await createManualTestCaseRecord({ title: "Caso base" }, "u-1");

    await expect(
      updateTestCaseRecord(
        record.testCase.id,
        {
          status: "invalid-status" as any,
        },
        "u-2",
      ),
    ).rejects.toThrow("INVALID_TEST_CASE_STATUS");
  });

  it("blocks duplicate automation link by same spec/tag without confirmation", async () => {
    const tc1 = await createManualTestCaseRecord({ title: "Caso 1" }, "u-1");
    const tc2 = await createManualTestCaseRecord({ title: "Caso 2" }, "u-1");

    await saveTestCaseAutomationLink(
      tc1.testCase.id,
      {
        specFile: "tests/ui/login.spec.ts",
        tags: ["@smoke"],
      },
      "u-1",
    );

    await expect(
      saveTestCaseAutomationLink(
        tc2.testCase.id,
        {
          specFile: "tests/ui/login.spec.ts",
          tags: ["@smoke"],
        },
        "u-1",
      ),
    ).rejects.toThrow("AUTOMATION_LINK_DUPLICATE");
  });

  it("allows duplicate automation link when explicitly confirmed", async () => {
    const tc1 = await createManualTestCaseRecord({ title: "Caso A" }, "u-1");
    const tc2 = await createManualTestCaseRecord({ title: "Caso B" }, "u-1");

    await saveTestCaseAutomationLink(
      tc1.testCase.id,
      {
        specFile: "tests/ui/profile.spec.ts",
        tags: ["@regression"],
      },
      "u-1",
    );

    const linked = await saveTestCaseAutomationLink(
      tc2.testCase.id,
      {
        specFile: "tests/ui/profile.spec.ts",
        tags: ["@regression"],
        allowDuplicate: true,
      },
      "u-2",
    );

    expect(linked?.automationLink?.specFile).toBe("tests/ui/profile.spec.ts");
    expect(linked?.automationLink?.tags).toEqual(["@regression"]);
  });
});

